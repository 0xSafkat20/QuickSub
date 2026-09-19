import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import type { Payment } from '../components/sections/OnlinePayment';
export default function AdminPayments({ orderId, onChange }: { orderId: string; onChange?: () => void }) {
  const [payments, setPayments] = useState<Payment[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [completed, setCompleted] = useState<string[]>([]);
  useEffect(() => { let active = true; api<{ payments: Payment[] }>('/admin/payments/' + orderId).then(r => { if (active) { setPayments(r.payments); setCompleted(r.payments.filter(p => p.refund_status === 'completed').map(p => p.id)); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [orderId]);
  return <section className="qs-admin-note qs-payment-box"><h3>Gateway payment history</h3>
    {!payments.length && <p>No online payment attempts.</p>}
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
          setPayments((await api<{ payments: Payment[] }>('/admin/payments/' + orderId)).payments); onChange?.();
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
          try { await api('/admin/payments/' + p.id + '/refund', { status: p.refund_status, reference: p.refund_reference, note: p.refund_note }); if (p.refund_status === 'completed') setCompleted(ids => [...ids, p.id]); setPayments((await api<{ payments: Payment[] }>('/admin/payments/' + orderId)).payments); onChange?.(); }
          catch (e) { setError((e as Error).message); } finally { setBusy(false); }
        }}>Save refund record</button>
      </>}
    </div>)}
    {error && <p role="alert">{error}</p>}
  </section>;
}
