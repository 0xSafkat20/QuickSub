import { useId } from 'react';
import { CreditCard, Landmark, Smartphone, CheckCircle2 } from 'lucide-react';
import { paymentMethods, type PaymentMethodId } from '../../data/paymentMethods';
export default function PaymentMethodPicker({ value, onChange, disabled = false }: { value: PaymentMethodId; onChange: (value: PaymentMethodId) => void; disabled?: boolean }) {
  const name = useId();
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="font-semibold mb-3">Choose a payment method</legend>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {paymentMethods.map(method => {
        const Icon = method.id === 'bank' ? Landmark : ['visa','mastercard'].includes(method.id) ? CreditCard : Smartphone;
        const selected = value === method.id;
        return <label key={method.id} className={`relative rounded-xl border-2 p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-2 ${selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <input type="radio" name={name} value={method.id} checked={selected} onChange={() => onChange(method.id)} className="sr-only" aria-label={method.name} />
          <Icon size={23} style={{ color: method.color }} aria-hidden="true" />
          {selected && <CheckCircle2 size={16} className="absolute right-2 top-2 text-brand-600" aria-hidden="true" />}
          <span className="block mt-3 text-sm font-bold">{method.name}</span>
          <span className="block mt-1 text-[11px] text-ink-500">{method.category}</span>
        </label>;
      })}
    </div>
  </fieldset>;
}
