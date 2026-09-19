import PaymentMethodPicker from '../ui/PaymentMethodPicker';
import { paymentMethods, type PaymentMethodId } from '../../data/paymentMethods';
import { useState } from 'react';
import { CheckCircle2, CreditCard, RotateCcw } from 'lucide-react';
export default function DemoPayment({ productName, packageName, amount, onBack }: { productName: string; packageName: string; amount: number; onBack: () => void }) {
  const [methodId, setMethodId] = useState<PaymentMethodId>('bkash');
  const method = paymentMethods.find(m => m.id === methodId)!;
  const [status, setStatus] = useState<'ready' | 'success' | 'failed'>('ready');
  return <section className="space-y-5" aria-label="Demo payment">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Demo checkout — no real payment</strong><p>These are example prices. This preview does not charge money, create a real order, or deliver a product.</p></div>
    <h2 className="text-xl font-bold">{status === 'success' ? 'Demo payment successful' : status === 'failed' ? 'Demo payment failed' : 'Review your demo order'}</h2>
    <div className="rounded-xl bg-brand-50 p-4 space-y-2"><p className="font-semibold">{productName}</p><p>{packageName}</p><p className="text-2xl font-bold text-brand-700">৳{amount}<span className="text-xs font-normal ml-2">example total</span></p></div>
    <PaymentMethodPicker value={methodId} onChange={value => { setMethodId(value); setStatus('ready'); }} disabled={status === 'success'} />
    <div className="rounded-xl border border-brand-100 p-4 text-sm space-y-2" aria-live="polite">
      <p className="font-semibold">{method.name} · ৳{amount}</p>
      <p>{method.detail}</p>
      <p className="text-ink-500">Demo only: no wallet number, card details, PIN, OTP, or transfer is needed.</p>
    </div>
    {status === 'success' ? <p role="status" className="flex gap-2 text-green-700"><CheckCircle2 className="shrink-0" size={20} />Your {method.name} checkout preview is complete. No money was collected.</p> : <>
      {status === 'failed' && <p role="alert" className="text-red-600">The simulated payment failed. Try again; your selected package is still here.</p>}
      <button type="button" onClick={() => setStatus('success')} className="w-full rounded-xl bg-brand-600 text-white font-semibold p-3 flex items-center justify-center gap-2"><CreditCard size={18} />{status === 'failed' ? 'Retry demo payment' : 'Simulate successful payment'}</button>
      {status === 'ready' && <button type="button" onClick={() => setStatus('failed')} className="w-full rounded-xl border border-brand-200 text-brand-700 p-3">Simulate failed payment</button>}
    </>}
    {status === "success" && <button type="button" onClick={() => setStatus("ready")} className="w-full rounded-xl border border-brand-200 text-brand-700 p-3">Try another payment method</button>}
    <button type="button" onClick={onBack} className="flex gap-2 items-center text-sm font-semibold text-brand-600"><RotateCcw size={16} />Choose another package</button>
  </section>;
}
