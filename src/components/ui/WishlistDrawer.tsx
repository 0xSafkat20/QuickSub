import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, ArrowRight, ShoppingBag } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';

interface WishlistDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function WishlistDrawer({ open, onClose }: WishlistDrawerProps) {
  const { favoriteProducts, toggleFavorite } = useWishlist();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 bottom-0 z-[61] w-full max-w-sm bg-white shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-brand-100">
              <div className="flex items-center gap-2">
                <Heart size={18} className="text-rose-500" />
                <h3 className="font-heading font-bold text-ink-900">Saved Products</h3>
                <span className="px-2 py-0.5 rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                  {favoriteProducts.length}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-brand-50 text-ink-400 transition-colors"
                aria-label="Close wishlist"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {favoriteProducts.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag size={40} className="text-brand-200 mx-auto mb-4" />
                  <p className="text-sm font-medium text-ink-500 mb-1">No saved products yet</p>
                  <p className="text-xs text-ink-300 mb-6">
                    Tap the heart icon on any product to save it for later.
                  </p>
                  <a
                    href="#products"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-5 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl"
                  >
                    Browse Products <ArrowRight size={14} />
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {favoriteProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex gap-3 p-3 rounded-xl border border-brand-100 hover:border-brand-200 transition-colors"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: product.accentColor }}
                      >
                        {product.name.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-800 truncate">{product.name}</p>
                        <p className="text-xs text-ink-400 mt-0.5">{product.startingPrice}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <a
                            href={`/buy?text=${encodeURIComponent(`Hi, I want to order ${product.name}. Please send me the package details and price.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-brand-600 hover:underline"
                          >
                            Order now
                          </a>
                          <button
                            onClick={() => toggleFavorite(product.id)}
                            className="text-xs text-ink-300 hover:text-red-500 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {favoriteProducts.length > 0 && (
              <div className="p-4 border-t border-brand-100">
                <a
                  href={`/buy?text=${encodeURIComponent(
                    `Hi, I want to order these products: ${favoriteProducts.map(p => p.name).join(', ')}. Please send me package details and prices.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 gradient-primary text-white text-sm font-semibold rounded-xl hover:shadow-blue-md transition-all"
                >
                  Order All via WhatsApp <ArrowRight size={14} />
                </a>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
