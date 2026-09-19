import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight, Clock, Tag } from 'lucide-react';
import type { Product } from '../../data/products';
import { useProducts } from '../../data/catalog';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
}

export default function SearchModal({ open, onClose, onSelectProduct }: SearchModalProps) {
  const products = useProducts();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return products.slice(0, 6);
    const q = query.toLowerCase();
    return products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.badges.some(b => b.toLowerCase().includes(q))
    );
  }, [query, products]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = useCallback((product: Product) => {
    onClose();
    onSelectProduct?.(product);
  }, [onClose, onSelectProduct]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && results[activeIndex]) {
        handleSelect(results[activeIndex]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, activeIndex, onClose, handleSelect]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-start justify-center pt-[6dvh] px-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl w-full max-w-xl max-h-[88dvh] flex flex-col shadow-2xl border border-brand-100 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-3 px-4 py-3 border-b border-brand-50">
              <Search size={18} className="text-ink-300 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search products, categories, badges…"
                className="flex-1 text-sm text-ink-800 placeholder-ink-300 focus:outline-none bg-transparent"
              />
              <kbd className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-brand-50 border border-brand-100 text-[10px] font-medium text-ink-400">
                ESC
              </kbd>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-brand-50 text-ink-400 transition-colors"
                aria-label="Close search"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 max-h-[60dvh] overflow-y-auto overscroll-contain p-2">
              {!query.trim() && (
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-300">
                  Popular products
                </p>
              )}
              {results.length === 0 ? (
                <div className="text-center py-10 text-sm text-ink-400">
                  No products match &quot;{query}&quot;
                </div>
              ) : (
                results.map((product, i) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelect(product)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      i === activeIndex ? 'bg-brand-50 border border-brand-200' : 'hover:bg-brand-50/60'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ backgroundColor: product.accentColor }}
                    >
                      {product.name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-800 truncate">{product.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-400">
                        <span className="flex items-center gap-1">
                          <Tag size={10} /> {product.startingPrice}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {product.deliveryEstimate}
                        </span>
                        <span className="capitalize">{product.category}</span>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-ink-300 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-brand-50 flex items-center justify-between text-[10px] text-ink-300">
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-brand-50 border border-brand-100">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-brand-50 border border-brand-100">Enter</kbd> select
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
