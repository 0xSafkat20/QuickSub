import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, Package, Clock, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';

type Status = 'idle' | 'searching' | 'found' | 'not_found';

const mockStatuses = [
  { id: 'QS-1001', status: 'Delivered', time: '2 hours ago', product: 'Spotify Premium' },
  { id: 'QS-1002', status: 'Processing', time: '30 min ago', product: 'PUBG UC 325' },
  { id: 'QS-1003', status: 'Pending', time: 'Just now', product: 'ChatGPT Plus' },
];

export default function OrderTracking() {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<typeof mockStatuses[0] | null>(null);

  const handleTrack = () => {
    if (!orderId.trim()) return;
    setStatus('searching');
    setResult(null);
    setTimeout(() => {
      const found = mockStatuses.find(m => m.id.toLowerCase() === orderId.trim().toLowerCase());
      if (found) {
        setResult(found);
        setStatus('found');
      } else {
        setStatus('not_found');
      }
    }, 1200);
  };

  const statusIcon = (s: string) => {
    if (s === 'Delivered') return <CheckCircle2 size={18} className="text-green-500" />;
    if (s === 'Processing') return <Loader2 size={18} className="text-amber-500 animate-spin" />;
    return <Clock size={18} className="text-blue-500" />;
  };

  const statusColor = (s: string) => {
    if (s === 'Delivered') return 'bg-green-50 border-green-200 text-green-700';
    if (s === 'Processing') return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-blue-50 border-blue-200 text-blue-700';
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-brand-200 text-brand-700 text-sm font-semibold hover:bg-brand-50 hover:border-brand-300 transition-all duration-200 shadow-sm"
      >
        <Package size={16} /> Track Order
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => { setOpen(false); setStatus('idle'); setResult(null); setOrderId(''); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="gradient-primary p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Package size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-white text-lg">Track Your Order</h3>
                      <p className="text-xs text-blue-100 mt-0.5">Enter your order ID to check status</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); setStatus('idle'); setResult(null); setOrderId(''); }}
                    className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-lg flex items-center justify-center text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                <div className="flex gap-2 mb-5">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
                    <input
                      value={orderId}
                      onChange={e => setOrderId(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleTrack()}
                      placeholder="e.g. QS-1001"
                      className="w-full pl-10 pr-3 py-3 border-2 border-brand-100 rounded-xl text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:border-brand-400 transition-all"
                    />
                  </div>
                  <button
                    onClick={handleTrack}
                    disabled={status === 'searching'}
                    className="px-5 py-3 gradient-primary text-white text-sm font-semibold rounded-xl hover:shadow-blue-md transition-all flex items-center gap-2 disabled:opacity-70"
                  >
                    {status === 'searching' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Track
                  </button>
                </div>

                {/* Results */}
                {status === 'found' && result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border-2 p-5 ${statusColor(result.status)}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {statusIcon(result.status)}
                      <span className="font-heading font-bold text-base">{result.status}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="opacity-70">Order ID</span>
                        <span className="font-semibold">{result.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Product</span>
                        <span className="font-semibold">{result.product}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Last Update</span>
                        <span className="font-semibold">{result.time}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {status === 'not_found' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border-2 border-red-200 bg-red-50 p-5 text-center"
                  >
                    <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
                    <p className="font-semibold text-red-700 mb-1">Order not found</p>
                    <p className="text-xs text-red-500">Please check your order ID and try again. Contact support if the issue persists.</p>
                  </motion.div>
                )}

                {status === 'idle' && (
                  <div className="text-center py-4">
                    <p className="text-xs text-ink-300">Try demo IDs: QS-1001, QS-1002, QS-1003</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
