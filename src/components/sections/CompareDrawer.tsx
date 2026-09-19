import { createContext, useContext, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCompare, Plus, Trash2 } from 'lucide-react';
import type { Product } from '../../data/products';
import { useProducts } from '../../data/catalog';

interface CompareContextType {
  compareList: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (id: string) => void;
  isInCompare: (id: string) => boolean;
}

const CompareContext = createContext<CompareContextType>({
  compareList: [],
  addToCompare: () => {},
  removeFromCompare: () => {},
  isInCompare: () => false,
});

export function useCompare() {
  return useContext(CompareContext);
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const products = useProducts();
  const [selectedProducts, setCompareList] = useState<Product[]>([]);
  const compareList = selectedProducts.flatMap(selected => products.filter(p => p.id === selected.id));

  const addToCompare = (product: Product) => {
    if (compareList.length >= 3 || compareList.some(p => p.id === product.id)) return;
    setCompareList(prev => [...prev, product]);
  };

  const removeFromCompare = (id: string) => {
    setCompareList(prev => prev.filter(p => p.id !== id));
  };

  const isInCompare = (id: string) => compareList.some(p => p.id === id);

  return (
    <CompareContext.Provider value={{ compareList, addToCompare, removeFromCompare, isInCompare }}>
      {children}
    </CompareContext.Provider>
  );
}

const compareFields: { label: string; render: (p: Product) => React.ReactNode }[] = [
  { label: 'Category', render: p => <span className="capitalize">{p.category}</span> },
  { label: 'Price', render: p => <span style={{ color: p.accentColor }} className="font-bold">{p.startingPrice}</span> },
  { label: 'Delivery', render: p => <span>{p.deliveryEstimate}</span> },
  { label: 'Popular Plan', render: p => <span>{p.popularPlan || 'N/A'}</span> },
  { label: 'Availability', render: p => p.outOfStock
    ? <span className="text-red-500 font-semibold">Out of Stock</span>
    : <span className="text-green-600 font-semibold">In Stock</span>
  },
  { label: 'Type', render: p => <span className="capitalize">{p.badges.join(', ')}</span> },
  { label: 'Description', render: p => <span className="text-xs">{p.shortDescription}</span> },
];

export default function CompareDrawer() {
  const products = useProducts();
  const { compareList, addToCompare, removeFromCompare } = useCompare();
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [hint, setHint] = useState(false);

  const handleOpenCompare = () => {
    if (compareList.length < 2) {
      setHint(true);
      setSelecting(true);
      setTimeout(() => setHint(false), 4000);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {compareList.length > 0 && !open && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleOpenCompare}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-5 py-3 bg-brand-600 text-white rounded-xl shadow-lg hover:bg-brand-700 transition-colors text-sm font-semibold"
        >
          <GitCompare size={16} />
          Compare ({compareList.length})
        </motion.button>
      )}

      <AnimatePresence>
        {selecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelecting(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-white rounded-2xl max-w-lg w-full max-h-[70dvh] overflow-y-auto overscroll-contain shadow-2xl p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-heading font-bold text-lg text-ink-900 mb-2">Select a product to compare</h3>
              {hint && (
                <p className="text-xs text-brand-600 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 mb-4">
                  Add at least 2 products to start comparing.
                </p>
              )}
              <div className="space-y-2">
                {products.filter(p => !compareList.some(c => c.id === p.id)).map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      addToCompare(p);
                      if (compareList.length + 1 >= 2) {
                        setSelecting(false);
                        setOpen(true);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-brand-100 hover:border-brand-300 hover:bg-brand-50 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${p.accentColor}15` }}>
                      <Plus size={14} style={{ color: p.accentColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{p.name}</p>
                      <p className="text-xs text-ink-400">{p.startingPrice}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && compareList.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-brand-200 shadow-2xl max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-3xl"
          >
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 p-4 border-b border-brand-50 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-2">
                <GitCompare size={18} className="text-brand-600" />
                <h3 className="font-heading font-bold text-ink-900">Product Comparison</h3>
              </div>
              <div className="flex items-center gap-2">
                {compareList.length < 3 && (
                  <button
                    onClick={() => setSelecting(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    <Plus size={12} className="inline mr-1" />Add
                  </button>
                )}
                <button aria-label="Close comparison" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-brand-50 text-ink-400 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-x-auto" role="region" aria-label="Product comparison table, scroll horizontally" tabIndex={0}>
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold text-ink-400 uppercase tracking-wider pb-4 pr-4 w-28" />
                    {compareList.map(p => (
                      <th key={p.id} className="text-center pb-4 px-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: p.accentColor }}>
                            <span className="text-white text-xs font-bold">{p.name.slice(0, 2)}</span>
                          </div>
                          <span className="text-sm font-bold text-ink-800">{p.name}</span>
                          <button aria-label={`Remove ${p.name} from comparison`} onClick={() => removeFromCompare(p.id)} className="text-ink-300 hover:text-red-500 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareFields.map(field => (
                    <tr key={field.label} className="border-t border-brand-50">
                      <td className="py-3 pr-4 text-xs font-semibold text-ink-400 uppercase tracking-wider">{field.label}</td>
                      {compareList.map(p => (
                        <td key={p.id} className="py-3 px-3 text-center text-sm text-ink-600">
                          {field.render(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
