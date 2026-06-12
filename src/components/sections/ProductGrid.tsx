import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { products, type Product } from '../../data/products';
import {
  type LucideIcon,
  Tv, Music, Crosshair, Diamond, Trophy, Swords, Bot, PenTool,
  ArrowRight, Clock, Tag, ImageOff, Search, X, SlidersHorizontal,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  tv: Tv, music: Music, crosshair: Crosshair,
  diamond: Diamond, trophy: Trophy, swords: Swords, bot: Bot, 'pen-tool': PenTool,
};

function ProductCard({ product, index }: { product: Product; index: number }) {
  const Icon = iconMap[product.icon] || Tv;
  const [imgError, setImgError] = useState(false);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.38, delay: index * 0.055 }}
      className="bg-white rounded-2xl overflow-hidden border border-brand-100 shadow-card hover:shadow-card-hover hover:-translate-y-1.5 transition-all duration-300 group flex flex-col"
    >
      {/* Banner Image */}
      <div className="relative h-40 overflow-hidden flex-shrink-0">
        {!imgError ? (
          <img
            src={product.bannerImage}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full banner-skeleton flex items-center justify-center">
            <ImageOff size={28} className="text-brand-300" />
          </div>
        )}

        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Bottom accent strip */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, ${product.accentColor}, ${product.accentColor}60)` }}
        />

        {/* Icon badge */}
        <div className="absolute top-3 left-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 border-white"
            style={{ backgroundColor: product.accentColor }}
          >
            <Icon size={18} className="text-white" />
          </div>
        </div>

        {/* Badges + New ribbon */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {product.isNew && (
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-brand-600 text-white shadow-sm">
              New
            </span>
          )}
          {product.badges.filter(b => b !== 'New').slice(0, 1).map(badge => (
            <span
              key={badge}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/90 shadow-sm"
              style={{ color: product.accentColor }}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-heading font-bold text-ink-900 text-base leading-tight mb-1.5">{product.name}</h3>
        <p className="text-xs text-ink-400 leading-relaxed mb-3 flex-1 line-clamp-3">{product.cardCopy}</p>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4 text-xs">
          <span className="flex items-center gap-1.5 font-bold" style={{ color: product.accentColor }}>
            <Tag size={11} /> {product.startingPrice}
          </span>
          <span className="flex items-center gap-1.5 text-ink-300">
            <Clock size={11} /> {product.deliveryEstimate}
          </span>
        </div>

        {/* CTA */}
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-200"
          style={{ borderColor: product.accentColor, color: product.accentColor }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = product.accentColor;
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.boxShadow = `0 6px 20px ${product.accentColor}40`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = product.accentColor;
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {product.cta} <ArrowRight size={13} />
        </button>
      </div>
    </motion.article>
  );
}

interface ProductGridProps {
  activeFilter: string;
}

export default function ProductGrid({ activeFilter }: ProductGridProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let list = activeFilter === 'all' ? products : products.filter(p => p.category === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.badges.some(b => b.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeFilter, searchQuery]);

  return (
    <section id="products" className="py-20 bg-page">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
            Choose Your QuickSub Product
          </h2>
          <p className="text-ink-400 max-w-2xl mx-auto mb-8">
            Find premium subscriptions, game top-ups, and AI access options in one organized product section.
          </p>

          {/* Search Bar */}
          <div className="max-w-md mx-auto relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products (e.g. Netflix, PUBG, AI…)"
              className="w-full pl-11 pr-10 py-3 bg-white border-2 border-brand-100 rounded-2xl text-sm text-ink-800 placeholder-ink-300 focus:outline-none focus:border-brand-400 focus:shadow-blue-sm transition-all shadow-card"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-600 transition-colors"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Result count */}
          {searchQuery && (
            <p className="text-xs text-ink-300 mt-3">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
            </p>
          )}
        </motion.div>

        {/* Active filter chip */}
        {activeFilter !== 'all' && (
          <div className="flex items-center gap-2 mb-6">
            <SlidersHorizontal size={14} className="text-ink-300" />
            <span className="text-xs text-ink-400">Filtered by:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-semibold text-brand-700 capitalize">
              {activeFilter}
            </span>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Search size={40} className="text-brand-200 mx-auto mb-4" />
            <p className="text-ink-400 font-medium mb-1">No products found</p>
            <p className="text-sm text-ink-300">
              Try a different search term or{' '}
              <button
                onClick={() => setSearchQuery('')}
                className="text-brand-600 hover:underline"
              >
                clear the search
              </button>
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}
