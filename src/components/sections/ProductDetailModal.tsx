import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, Clock, Tag, Shield, MessageCircle,
  Truck, RefreshCw, Headphones,
} from 'lucide-react';
import type { Product } from '../../data/products';

const trustBadges = [
  { icon: Shield, label: 'Secure Payment' },
  { icon: Truck, label: 'Fast Delivery' },
  { icon: RefreshCw, label: 'Refund Policy' },
  { icon: Headphones, label: '24/7 Support' },
];

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

export default function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  if (!product) return null;

  const oos = !!product.outOfStock;

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header image */}
            <div className="relative h-56 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden rounded-t-3xl">
              <img
                src={product.bannerImage}
                alt={product.name}
                className={`w-full h-full object-cover ${oos ? 'grayscale' : ''}`}
              />
              {oos && (
                <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                  <span className="px-6 py-2 bg-red-500 text-white font-bold rounded-xl text-sm">Out of Stock</span>
                </div>
              )}
              <div
                className="absolute bottom-0 left-0 right-0 h-1.5"
                style={{ background: `linear-gradient(90deg, ${product.accentColor}, ${product.accentColor}60)` }}
              />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-ink-600 hover:bg-white transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
              {product.isNew && !oos && (
                <span className="absolute top-4 left-4 px-3 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-brand-600 text-white shadow-sm">
                  New
                </span>
              )}
            </div>

            {/* Content */}
            <div className="p-7">
              {/* Title + badges */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="font-heading text-2xl font-bold text-ink-900">{product.name}</h2>
                {oos && (
                  <span className="flex-shrink-0 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-bold text-red-500 uppercase">
                    Unavailable
                  </span>
                )}
              </div>

              {/* Category + badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span
                  className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${product.accentColor}15`, color: product.accentColor }}
                >
                  {product.category}
                </span>
                {product.badges.map(badge => (
                  <span
                    key={badge}
                    className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-slate-100 text-ink-500"
                  >
                    {badge}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p className="text-ink-500 text-sm leading-relaxed mb-6">{product.cardCopy}</p>

              {/* Price + delivery */}
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <Tag size={16} style={{ color: product.accentColor }} />
                  <span className="font-heading font-bold text-lg" style={{ color: product.accentColor }}>
                    {product.startingPrice}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-ink-400 text-sm">
                  <Clock size={14} />
                  <span>{product.deliveryEstimate}</span>
                </div>
              </div>

              {/* Popular plan */}
              {product.popularPlan && (
                <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6">
                  <p className="text-xs text-brand-600 font-semibold uppercase tracking-wider mb-1">Most Popular Plan</p>
                  <p className="font-heading font-bold text-ink-900">{product.popularPlan}</p>
                </div>
              )}

              {/* Trust badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
                {trustBadges.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 py-3 bg-slate-50 rounded-xl">
                    <Icon size={18} className="text-brand-600" />
                    <span className="text-[11px] font-semibold text-ink-500">{label}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {oos ? (
                <div className="space-y-3">
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed"
                  >
                    Out of Stock
                  </button>
                  <p className="text-center text-xs text-ink-300">Join the waitlist to be notified when this product returns</p>
                </div>
              ) : (
                <a
                  href={`/buy?text=${encodeURIComponent(`Hi, I want to order ${product.name}. Please send me the package details and price.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:shadow-lg"
                  style={{ backgroundColor: product.accentColor }}
                >
                  {product.cta} <ArrowRight size={15} />
                </a>
              )}

              {/* Support link */}
              <div className="mt-5 text-center">
                <a href="#faq" onClick={onClose} className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-brand-600 transition-colors">
                  <MessageCircle size={12} /> Have questions? Check our FAQ
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
