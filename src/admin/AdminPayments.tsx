import { useCallback, useEffect, useState } from 'react';
import { api } from '../utils/api';
import type { Payment } from '../components/sections/OnlinePayment';

type ManualPayment = {
  id: string;
  method: 'bkash' | 'nagad' | 'rocket' | 'bank_transfer';
  amount_bdt: number;
  transaction_reference: string;
  payer_phone: string | null;
  payer_name: string;
  sender_bank: string;
  account_last_four: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
};

type OrderPaymentSummary = { method: string; reference: string; amount: number; status: string };
const friendlyMethod = (method: string) => ({
  bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', bank_transfer: 'Bank transfer',
  visa: 'Visa', mastercard: 'Mastercard',
})[method as ManualPayment['method']] || method.replace(/_/g, ' ');

export default function AdminPayments({ orderId, orderPayment, onChange }: { orderId: string; orderPayment?: OrderPaymentSummary; onChange?: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manual, setManual] = useState<ManualPayment[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [gatewayResult, manualResult] = await Promise.allSettled([
      api<{ payments: Payment[] }>('/admin/payments/' + orderId),
      api<{ payments: ManualPayment[] }>('/admin/manual-payments/' + orderId),
    ]);
    if (gatewayResult.status === 'fulfilled') {
      setPayments(gatewayResult.value.payments);
      setCompleted(gatewayResult.value.payments.filter(p => p.refund_status === 'completed').map(p => p.id));
    }
    if (manualResult.status === 'fulfilled') setManual(manualResult.value.payments);
    const problems = [gatewayResult, manualResult].filter(result => result.status === 'rejected');
    setError(problems.length === 2 ? 'Payment records are unavailable. Check the database migration, then refresh.' : '');
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  const submitted = manual[0];
  const gateway = payments[0];
  const method = orderPayment?.method || submitted?.method || (gateway ? 'online_gateway' : '');
  const reference = orderPayment?.reference || submitted?.transaction_reference || gateway?.bank_reference || '';
  const amount = orderPayment?.amount ?? submitted?.amount_bdt ?? gateway?.amount_bdt ?? 0;
  const status = orderPayment?.status || submitted?.status || gateway?.status || '';
  const hasSubmission = Boolean(method || reference || manual.length || payments.length);

  return <section className="qs-admin-note qs-payment-box" aria-labelledby="payment-record-heading">
    <div className="qs-payment-record-heading"><div><h3 id="payment-record-heading">Payment record</h3><p>Check these details against your merchant or bank account before approving the order.</p></div>{status && <span className={`qs-admin-badge qs-payment-status-${status}`}>{status}</span>}</div>
    {hasSubmission ? <dl className="qs-payment-summary">
      <div><dt>Method</dt><dd>{method ? friendlyMethod(method) : 'Not selected'}</dd></div>
      <div><dt>Reference / TrxID</dt><dd>{reference || 'Not submitted'}</dd></div>
      <div><dt>Amount</dt><dd>BDT {Number(amount).toFixed(2)}</dd></div>
      <div><dt>Payment status</dt><dd>{status || 'Unknown'}</dd></div>
    </dl> : !error && <div className="qs-payment-empty"><strong>No payment submitted</strong><span>The customer has not provided a payment method or transaction reference yet.</span></div>}
    {manual.map(p => <article key={p.id} className="qs-manual-payment-record">
      <h4>Customer-submitted details</h4>
      {p.payer_phone && <p>Customer mobile: {p.payer_phone}</p>}
      {p.payer_name && <p>Sender: {p.payer_name}</p>}
      {p.sender_bank && <p>Bank: {p.sender_bank}</p>}
      {p.account_last_four && <p>Account ending: •••• {p.account_last_four}</p>}
      <p className="qs-admin-muted">Submitted {new Date(p.submitted_at).toLocaleString()}</p>
      {p.status === 'submitted' && <p className="qs-admin-payment-warning">Verification required before changing the payment status to verified.</p>}
    </article>)}
    {payments.length > 0 && <h4>Online gateway history</h4>}
    {payments.map(p => <div key={p.id} style={{ borderTop: '1px solid #ddd', paddingTop: 12, marginTop: 12 }}>
      <p><strong>{p.status}</strong> · BDT {p.amount_bdt}</p><p style={{ overflowWrap: 'anywhere' }}>{p.id}</p>
      <p>Bank reference: {p.bank_reference || 'Awaiting confirmation'}</p>
      <p>Refund: {p.refund_status} {p.refund_reference}</p>
      {['pending','failed','cancelled','review'].includes(p.status) && <button type="button" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try {
          if (p.status === 'review') {
            const note = window.prompt('Owner review: explain how you confirmed this payment is safe to fulfill (at least 10 characters). Resolve or refund duplicate payments first.');
            if (!note) return;
            await api('/admin/payments/' + p.id + '/approve', { note });
          } else await api('/admin/payments/' + p.id + '/check', {});
          await load(); onChange?.();
        } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>{p.status === 'review' ? 'Approve after review (owner)' : 'Recheck with provider'}</button>}
      {['verified','review'].includes(p.status) && !completed.includes(p.id) && <>
        <p>Process refunds in the merchant portal first. These controls record progress; they do not move money. A completed refund needs the provider reference.</p>
        <label>Refund status<select value={p.refund_status} onChange={e => setPayments(rows => rows.map(x => x.id === p.id ? { ...x, refund_status: e.target.value } : x))}>
          <option value="none">Choose status</option>{['requested','pending','completed','failed'].map(s => <option key={s}>{s}</option>)}
        </select></label>
        <label>Provider refund reference<input value={p.refund_reference} maxLength={160} onChange={e => setPayments(rows => rows.map(x => x.id === p.id ? { ...x, refund_reference: e.target.value } : x))} /></label>
        <label>Internal refund note<textarea value={p.refund_note} maxLength={1000} onChange={e => setPayments(rows => rows.map(x => x.id === p.id ? { ...x, refund_note: e.target.value } : x))} /></label>
        <button type="button" disabled={busy || p.refund_status === 'none'} onClick={async () => {
          setBusy(true); setError('');
          try { await api('/admin/payments/' + p.id + '/refund', { status: p.refund_status, reference: p.refund_reference, note: p.refund_note }); if (p.refund_status === 'completed') setCompleted(ids => [...ids, p.id]); await load(); onChange?.(); }
          catch (e) { setError((e as Error).message); } finally { setBusy(false); }
        }}>Save refund record</button>
      </>}
    </div>)}
    {error && <p role="alert">{error}</p>}
  </section>;
}
