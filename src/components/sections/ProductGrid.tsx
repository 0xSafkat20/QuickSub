import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { products, type Product } from '../../data/products';
import ProductDetailModal from './ProductDetailModal';
import {
  type LucideIcon,
  Tv, Music, Crosshair, Diamond, Trophy, Swords, Bot, PenTool,
  Clapperboard, PlayCircle, Zap, Palette, LayoutGrid,
  Sword, Box, Image, FileText, CheckCircle, Layers,
  ArrowRight, Clock, Tag, ImageOff, Search, X, SlidersHorizontal, Bell, PackageX, Heart, HeartOff, ChevronDown,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  tv: Tv,
  music: Music,
  crosshair: Crosshair,
  diamond: Diamond,
  trophy: Trophy,
  swords: Swords,
  bot: Bot,
  'pen-tool': PenTool,
  clapperboard: Clapperboard,
  'play-circle': PlayCircle,
  zap: Zap,
  palette: Palette,
  'layout-grid': LayoutGrid,
  sword: Sword,
  box: Box,
  image: Image,
  'file-text': FileText,
  'check-circle': CheckCircle,
  layers: Layers,
};

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'newest';

const priceMap: Record<string, number> = {
  '1': 299, '2': 149, '3': 199, '4': 99, '5': 249, '6': 89,
  '7': 499, '8': 349, '9': 199, '10': 179, '11': 149, '12': 399,
  '13': 599, '14': 169, '15': 149, '16': 99, '17': 449, '18': 399,
  '19': 299, '20': 799, '21': 199,
};

function ProductCard({
  product,
  index,
  isFavorite,
  isNotified,
  onToggleFavorite,
  onRequestNotify,
  onOpenDetail,
}: {
  product: Product;
  index: number;
  isFavorite: boolean;
  isNotified: boolean;
  onToggleFavorite: (id: string) => void;
  onRequestNotify: (product: Product) => void;
  onOpenDetail: (product: Product) => void;
}) {
  const Icon = iconMap[product.icon] || Tv;
  const [imgError, setImgError] = useState(false);
  const oos = !!product.outOfStock;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.38, delay: index * 0.05 }}
      className={`bg-white rounded-2xl overflow-hidden border shadow-card flex flex-col transition-all duration-300 ${
        oos
          ? 'border-slate-200 opacity-80'
          : 'border-brand-100 hover:shadow-card-hover hover:-translate-y-1.5 group'
      }`}
    >
      {/* Banner Image */}
      <div className="relative h-40 overflow-hidden flex-shrink-0 bg-white">
        {!imgError ? (
          <img
            src={product.bannerImage}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className={`w-full h-full object-contain transition-transform duration-500 ${
              oos ? 'grayscale' : 'group-hover:scale-105'
            }`}
          />
        ) : (
          <div className="w-full h-full banner-skeleton flex items-center justify-center">
            <ImageOff size={28} className="text-brand-300" />
          </div>
        )}

        {/* Dark overlay on OOS */}
        {oos && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <PackageX size={32} className="text-white/90" />
              <span className="text-white font-bold text-sm tracking-wide">Out of Stock</span>
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        {!oos && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        )}

        {/* Bottom accent strip */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 transition-opacity ${oos ? 'opacity-30' : 'opacity-100'}`}
          style={{ background: `linear-gradient(90deg, ${product.accentColor}, ${product.accentColor}60)` }}
        />

        {/* Icon badge — hidden when OOS overlay is showing */}
        {!oos && (
          <div className="absolute top-3 left-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border-2 border-white"
              style={{ backgroundColor: product.accentColor }}
            >
              <Icon size={18} className="text-white" />
            </div>
          </div>
        )}

        {/* Status + type badges (top-right) */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {product.isNew && !oos && (
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-brand-600 text-white shadow-sm">
              New
            </span>
          )}
          {!oos && product.badges.filter(b => b !== 'New').slice(0, 1).map(badge => (
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
      <div className="p-5 flex flex-col flex-1 cursor-pointer" onClick={() => onOpenDetail(product)}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className={`font-heading font-bold text-base leading-tight ${oos ? 'text-ink-400' : 'text-ink-900'}`}>
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(product.id)}
              className={`w-9 h-9 rounded-2xl border flex items-center justify-center transition-colors ${
                isFavorite ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-ink-500 hover:bg-brand-50'
              }`}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? <Heart size={16} /> : <HeartOff size={16} />}
            </button>
            {oos && (
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px] font-bold text-red-500 uppercase tracking-wide">
                Unavailable
              </span>
            )}
          </div>
        </div>

        <p className={`text-xs leading-relaxed mb-3 flex-1 line-clamp-3 ${oos ? 'text-ink-300' : 'text-ink-400'}`}>
          {product.cardCopy}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4 text-xs">
          <span
            className={`flex items-center gap-1.5 font-bold ${oos ? 'text-slate-400' : ''}`}
            style={oos ? {} : { color: product.accentColor }}
          >
            <Tag size={11} /> {product.startingPrice}
          </span>
          <span className="flex items-center gap-1.5 text-ink-300">
            <Clock size={11} /> {product.deliveryEstimate}
          </span>
        </div>

        {/* CTA — conditional on out-of-stock */}
        {oos ? (
          <div className="space-y-2">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed select-none"
            >
              <PackageX size={14} /> Out of Stock
            </button>
            <button
              onClick={() => onRequestNotify(product)}
              disabled={isNotified}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                isNotified
                  ? 'border-brand-200 bg-brand-50 text-brand-600 cursor-default'
                  : 'border-brand-200 text-brand-600 hover:bg-brand-50'
              }`}
            >
              <Bell size={12} />
              {isNotified ? 'Notification set!' : 'Notify me when available'}
            </button>
          </div>
        ) : (
          <a
            href={`/buy?text=${encodeURIComponent(`Hi, I want to order ${product.name}. Please send me the package details and price.`)}`}
            target="_blank"
            rel="noopener noreferrer"
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
          </a>
        )}
      </div>
    </motion.article>
  );
}

interface ProductGridProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function ProductGrid({ activeFilter, onFilterChange }: ProductGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [notifiedProducts, setNotifiedProducts] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = activeFilter === 'all' ? [...products] : products.filter(p => p.category === activeFilter);
    if (inStockOnly) list = list.filter(p => !p.outOfStock);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.badges.some(b => b.toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case 'price-asc':
        list.sort((a, b) => (priceMap[a.id] ?? 0) - (priceMap[b.id] ?? 0));
        break;
      case 'price-desc':
        list.sort((a, b) => (priceMap[b.id] ?? 0) - (priceMap[a.id] ?? 0));
        break;
      case 'name-asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        list.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
    }
    return list;
  }, [activeFilter, searchQuery, inStockOnly, sortBy]);

  const totalOos = useMemo(
    () => (activeFilter === 'all' ? products : products.filter(p => p.category === activeFilter)).filter(p => p.outOfStock).length,
    [activeFilter]
  );

  const toggleFavorite = (productId: string) => {
    setFavorites(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const requestNotify = (product: Product) => {
    setNotifiedProducts(prev => (prev.includes(product.id) ? prev : [...prev, product.id]));
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, productName: product.name }),
    }).catch(() => {});
  };

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

          {searchQuery && (
            <p className="text-xs text-ink-300 mt-3">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
            </p>
          )}
        </motion.div>

        {/* Filter toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            {activeFilter !== 'all' && (
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-ink-300" />
                <span className="text-xs text-ink-400">Filtered by:</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-xs font-semibold text-brand-700 capitalize">
                  {activeFilter}
                </span>
              </div>
            )}
            <span className="text-xs text-ink-300">
              {filtered.length} product{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(v => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border-2 border-brand-200 bg-white text-ink-500 hover:border-brand-400 hover:text-brand-700 transition-all duration-200"
              >
                <SlidersHorizontal size={13} />
                Sort: {{ 'default': 'Default', 'price-asc': 'Price: Low', 'price-desc': 'Price: High', 'name-asc': 'A-Z', 'newest': 'Newest' }[sortBy]}
                <ChevronDown size={12} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-brand-100 rounded-xl shadow-lg z-20 py-1">
                    {([
                      ['default', 'Default'],
                      ['price-asc', 'Price: Low to High'],
                      ['price-desc', 'Price: High to Low'],
                      ['name-asc', 'Name: A to Z'],
                      ['newest', 'Newest First'],
                    ] as [SortOption, string][]).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => { setSortBy(val); setSortOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                          sortBy === val ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-brand-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {activeFilter !== 'all' && (
              <button
                onClick={() => onFilterChange('all')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border-2 border-brand-200 bg-white text-brand-700 hover:bg-brand-50 transition-all duration-200"
              >
                Clear category
              </button>
            )}
            {totalOos > 0 && (
              <button
                onClick={() => setInStockOnly(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${
                  inStockOnly
                    ? 'bg-brand-600 border-brand-600 text-white shadow-blue-sm'
                    : 'bg-white border-brand-200 text-ink-500 hover:border-brand-400 hover:text-brand-700'
                }`}
              >
                <PackageX size={13} />
                {inStockOnly ? 'Showing in-stock only' : `Hide out of stock (${totalOos})`}
              </button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                index={i}
                isFavorite={favorites.includes(product.id)}
                isNotified={notifiedProducts.includes(product.id)}
                onToggleFavorite={toggleFavorite}
                onRequestNotify={requestNotify}
                onOpenDetail={setDetailProduct}
              />
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
              Try a different search or{' '}
              <button
                onClick={() => { setSearchQuery(''); setInStockOnly(false); }}
                className="text-brand-600 hover:underline"
              >
                reset filters
              </button>
            </p>
          </motion.div>
        )}

      </div>

      <ProductDetailModal product={detailProduct} onClose={() => setDetailProduct(null)} />
    </section>
  );
}
