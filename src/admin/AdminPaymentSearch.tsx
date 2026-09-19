import { useState } from 'react';
import { api } from '../utils/api';
import AdminPayments from './AdminPayments';
export default function AdminPaymentSearch({ onChange }: { onChange?: () => void }) {
  const [reference, setReference] = useState(''), [orders, setOrders] = useState<string[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <section className="qs-admin-card qs-payment-box"><h3>Find a gateway transaction</h3><form onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(''); setOrders([]);
    try { const result = await api<{ orders: string[] }>('/admin/payment-search?reference=' + encodeURIComponent(reference.trim())); setOrders(result.orders); if (!result.orders.length) setError('No matching transaction. Enter the full payment ID or bank reference.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><label>Payment ID or bank reference<input required minLength={3} maxLength={160} value={reference} onChange={e => setReference(e.target.value)} /></label><button disabled={busy}>{busy ? 'Searching…' : 'Find payment'}</button></form>
    {error && <p role="alert">{error}</p>}{orders.map(id => <div key={id}><p>Order: {id}</p><AdminPayments orderId={id} onChange={onChange} /></div>)}
  </section>;
}
