import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Loader2, MessageCircle } from 'lucide-react';

export default function SupportContactButton({ message }: { message: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const reducedMotion = useReducedMotion();

  async function openSupport() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/contact?text=' + encodeURIComponent(message), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Support unavailable');
      }
      const data = await response.json();
      if (typeof data.whatsapp !== 'string') throw new Error('Invalid support link');
      const url = new URL(data.whatsapp);
      if (url.origin !== 'https://wa.me' || !/^\/[0-9]{8,15}$/.test(url.pathname) || url.username || url.password) {
        throw new Error('Invalid support link');
      }
      window.location.assign(url.href);
    } catch {
      setError('We couldn’t connect to support right now. Please try again shortly. Your product selection is still here.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <div className="space-y-3">
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={() => void openSupport()}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-brand-700 hover:shadow-md active:scale-[0.99] disabled:cursor-wait disabled:opacity-75 motion-reduce:transition-none motion-reduce:transform-none"
    >
      {busy ? <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <MessageCircle size={18} aria-hidden="true" />}
      <span aria-live="polite">{busy ? 'Opening WhatsApp…' : error ? 'Try support again' : 'Ask support for packages'}</span>
      {!busy && <ArrowUpRight size={16} aria-hidden="true" />}
    </button>
    <AnimatePresence initial={false}>
      {error && <motion.div
        key="support-error"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        className="overflow-hidden"
      ><p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}</p></motion.div>}
    </AnimatePresence>
  </div>;
}
