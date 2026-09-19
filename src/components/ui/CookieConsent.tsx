import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';
import { safeStorageGet, safeStorageSet } from '../../utils/storage';

const STORAGE_KEY = 'quicksub-cookie-consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = safeStorageGet(STORAGE_KEY);
    if (!accepted) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    safeStorageSet(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="fixed bottom-4 left-4 right-4 z-[55] max-w-lg mx-auto max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-brand-100 p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                <Cookie size={18} className="text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-800 mb-1">We use cookies</p>
                <p className="text-xs text-ink-400 leading-relaxed">
                  QuickSub uses local storage to save your preferences (favorites, cookie consent).
                  No tracking cookies are used.{' '}
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('quicksub:open-legal', { detail: 'Cookie Policy' }))}
                    className="text-brand-600 hover:underline"
                  >
                    Learn more
                  </button>
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
              <button
                onClick={accept}
                className="flex-1 sm:flex-none px-5 py-2.5 gradient-primary text-white text-xs font-semibold rounded-xl hover:shadow-blue-sm transition-all"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
