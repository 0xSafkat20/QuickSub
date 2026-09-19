import { useStore } from '../../data/store';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import { legalDocuments } from '../../data/legal';

export default function LegalModal() {
  const policies = useStore().policies;
  const [open, setOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const title = (e as CustomEvent<string>).detail;
      if (title && legalDocuments[title]) {
        setActiveDoc(title);
        setOpen(true);
      }
    };
    window.addEventListener('quicksub:open-legal', handler);
    return () => window.removeEventListener('quicksub:open-legal', handler);
  }, []);

  const doc = activeDoc ? policies?.[activeDoc] || legalDocuments[activeDoc] : null;

  const close = () => {
    setOpen(false);
    setActiveDoc(null);
  };

  return (
    <AnimatePresence>
      {open && doc && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85dvh] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-brand-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                  <FileText size={16} className="text-brand-600" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-ink-900">{doc.title}</h3>
                  <p className="text-[10px] text-ink-300">Last updated: {doc.lastUpdated}</p>
                </div>
              </div>
              <button
                onClick={close}
                className="p-2 rounded-lg hover:bg-brand-50 text-ink-400 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain p-6 space-y-6">
              {doc.sections.map(section => (
                <div key={section.heading}>
                  <h4 className="font-heading font-semibold text-sm text-ink-800 mb-2">{section.heading}</h4>
                  <p className="text-sm text-ink-500 leading-relaxed">{section.body}</p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-brand-50 flex flex-wrap gap-2 flex-shrink-0">
              {Object.keys(legalDocuments).map(title => (
                <button
                  key={title}
                  onClick={() => setActiveDoc(title)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeDoc === title
                      ? 'bg-brand-600 text-white'
                      : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function openLegalDoc(title: string) {
  window.dispatchEvent(new CustomEvent('quicksub:open-legal', { detail: title }));
}
