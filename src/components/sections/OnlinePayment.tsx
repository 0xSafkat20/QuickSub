import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import type { TrackedOrder } from './CustomerOrder';
export type Payment = { id: string; status: string; amount_bdt: number; bank_reference: string | null; created_at: string; refund_status: string; refund_reference: string; refund_note: string };
const field = 'w-full border border-brand-200 rounded-xl p-3 mt-1';
const button = 'px-4 py-2 rounded-xl bg-brand-600 text-white disabled:opacity-50';
export default function OnlinePayment({ order, accessCode, onUpdate, onBlockingChange }: { order: TrackedOrder; accessCode: string; onUpdate: (order: TrackedOrder) => void; onBlockingChange: (blocked: boolean) => void }) {
  const [enabled, setEnabled] = useState(false), [payments, setPayments] = useState<Payment[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [simulation,setSimulation]=useState(false);
  const [demoMethod,setDemoMethod]=useState('bKash');
  useEffect(() => {
    let active = true;
    Promise.all([api<{ enabled: boolean; simulation?: boolean }>('/payments/config'), api<{ payments: Payment[] }>('/orders/payments', { id: order.id, accessCode })])
      .then(([config, data]) => { if (active) { setEnabled(config.enabled); setSimulation(!!config.simulation); setPayments(data.payments); onBlockingChange(data.payments.some(p => p.status === "pending" || (p.status === "review" && p.refund_status !== "completed"))); } })
      .catch(() => { if (active) setError('Online payment history is unavailable. Refresh before paying again.'); });
    return () => { active = false; };
  }, [order.id, accessCode, order.payment_status, onBlockingChange]);
  const payable = order.status === 'pending' && ['unpaid', 'rejected'].includes(order.payment_status) && !payments.some(p => p.status === 'review' && p.refund_status !== 'completed');
  return <section className="rounded-xl border border-brand-200 p-4 space-y-3" aria-label="Online payment">
    <h3 className="font-bold">Online payment</h3>
    {!enabled && <p>Online checkout is currently unavailable. Contact support if you have an unresolved payment.</p>}
    {enabled && payable && <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      const data = new FormData(e.currentTarget);
      try {
        if(simulation){const result=await api<{order:TrackedOrder}>('/demo/pay',{id:order.id,accessCode,email:data.get('email'),method:demoMethod});onUpdate(result.order);return;}
        const result = await api<{ url: string }>('/orders/checkout', { id: order.id, accessCode, email: data.get('email'), phone: data.get('phone') });
        window.location.assign(result.url);
      } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>
      <label className="block">Receipt email<input className={field} type="email" name="email" defaultValue={order.receipt_email} required maxLength={50} autoComplete="email" /></label>
      <label className="block">Phone number<input className={field} type="tel" name="phone" required pattern="\+?[0-9]{8,20}" maxLength={21} autoComplete="tel" placeholder="01712345678" /></label>
      {simulation&&<label className="block">Demo payment method<select className={field} value={demoMethod} onChange={e=>setDemoMethod(e.target.value)}><option>bKash</option><option>Nagad</option><option>Visa / Mastercard</option></select></label>}
      <label className="flex items-start gap-2"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} required />I have saved my order receipt. Keep this browser available to track a guest order.</label>
      <p className="text-xs">{simulation?'Simulation only. No money will be collected.':'You will leave QuickSub to select a payment method. Your email and phone are shared with the payment provider.'}</p>
      <button className={button} disabled={busy || !saved}>{busy ? 'Opening checkout…' : simulation ? 'Simulate online payment' : payments.some(p => p.status === 'pending') ? 'Resume checkout' : `Pay online · ৳${order.amount_bdt}`}</button>
    </form>}
    {payments.length > 0 && <>
      <ul className="space-y-2">{payments.map(p => <li key={p.id} className="rounded-lg bg-brand-50 p-3 break-words">
        <strong>{p.status === 'pending' ? 'Verification pending' : p.status === 'verified' ? 'Payment confirmed' : p.status === 'review' ? 'Payment needs staff review — contact support' : `Payment ${p.status}`}</strong>
        <p className="text-xs">{p.id} · ৳{p.amount_bdt}</p>
        {p.refund_status !== 'none' && <p>Refund: {p.refund_status}{p.refund_reference ? ` · ${p.refund_reference}` : ''}</p>}
      </li>)}</ul>
      <button type="button" className={button} disabled={busy || !enabled} onClick={async () => {
        setBusy(true); setError('');
        try { const result = await api<{ order: TrackedOrder; payments: Payment[] }>('/orders/payments/check', { id: order.id, accessCode }); setPayments(result.payments); onBlockingChange(result.payments.some(p => p.status === "pending" || (p.status === "review" && p.refund_status !== "completed"))); onUpdate(result.order); }
        catch (err) { setError((err as Error).message); } finally { setBusy(false); }
      }}>{busy ? 'Checking…' : 'Check payment status'}</button>
      <p className="text-xs">If verification is pending, check again shortly. Do not make another payment while confirmation is pending.</p>
    </>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
  </section>;
}
