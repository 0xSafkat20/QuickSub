import { useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../../utils/api';

export default function ProductReviewForm({ orderId, productName }: { orderId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">Review this purchase</button>;
  return <form className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api('/account/reviews', { orderId, rating, comment });
      setMessage('Thank you — your verified review is now visible on the website.');
      window.dispatchEvent(new CustomEvent('quicksub:review-saved'));
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }}>
    <div><p className="font-bold text-sm">Review {productName}</p><p className="text-xs text-ink-500">Your review will show a Verified purchase badge. You can update it later.</p></div>
    <fieldset><legend className="text-xs font-semibold mb-1">Your rating</legend><div className="flex gap-1">
      {[1,2,3,4,5].map(value => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={rating === value}><Star size={24} className={value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} /></button>)}
    </div></fieldset>
    <label className="block text-xs font-semibold">Product comment<textarea value={comment} onChange={event => setComment(event.target.value)} required minLength={10} maxLength={1000} rows={3} placeholder="Tell other customers about the product and delivery experience…" className="mt-1 w-full rounded-xl border border-brand-200 bg-white p-3 text-sm font-normal outline-none focus:border-brand-500" /></label>
    <div className="flex gap-2"><button disabled={busy || comment.trim().length < 10} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Publishing…' : 'Publish review'}</button><button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-ink-500">Close</button></div>
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}
