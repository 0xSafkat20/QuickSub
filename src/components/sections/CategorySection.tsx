import { motion } from 'framer-motion';
import { Tv, Music, Gamepad2, Bot, Layers, ArrowRight } from 'lucide-react';
import { products } from '../../data/products';

interface CategorySectionProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const categoryData = [
  {
    id: 'all',
    label: 'All Products',
    icon: Layers,
    description: 'Browse the full QuickSub catalog — streaming, music, gaming, and AI tools in one place.',
    highlight: 'Everything',
    color: '#2563EB',
    bgLight: '#EFF6FF',
    bgDark: '#DBEAFE',
  },
  {
    id: 'streaming',
    label: 'Streaming',
    icon: Tv,
    description: 'Premium video streaming subscriptions — movies, series, and family plans delivered fast.',
    highlight: 'Watch Anywhere',
    color: '#E50914',
    bgLight: '#FFF1F2',
    bgDark: '#FECDD3',
  },
  {
    id: 'music',
    label: 'Music',
    icon: Music,
    description: 'Enjoy ad-free music, podcasts, and offline playlists with premium streaming plans.',
    highlight: 'Listen Freely',
    color: '#1DB954',
    bgLight: '#F0FDF4',
    bgDark: '#BBF7D0',
  },
  {
    id: 'gaming',
    label: 'Gaming Top-Up',
    icon: Gamepad2,
    description: 'PUBG UC, Freefire Diamonds, Mobile Legends Coins, and eFootball — all top-ups in minutes.',
    highlight: 'Level Up',
    color: '#F59E0B',
    bgLight: '#FFFBEB',
    bgDark: '#FDE68A',
  },
  {
    id: 'ai',
    label: 'AI Tools',
    icon: Bot,
    description: 'ChatGPT, QuillBot Premium, and leading AI tools for writing, coding, paraphrasing, and productivity.',
    highlight: 'Work Smarter',
    color: '#10A37F',
    bgLight: '#F0FDFA',
    bgDark: '#99F6E4',
  },
];

export default function CategorySection({ activeFilter, onFilterChange }: CategorySectionProps) {
  const countByCategory = (cat: string) =>
    cat === 'all' ? products.length : products.filter(p => p.category === cat).length;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold uppercase tracking-wider mb-4">
            Product Categories
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
            Find What You Need, Fast
          </h2>
          <p className="text-ink-400 max-w-2xl mx-auto text-base">
            QuickSub covers streaming, music, gaming currencies, and AI tools — all organized in clear categories so you can shop without confusion.
          </p>
        </motion.div>

        {/* Category Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-10">
          {categoryData.map((cat, i) => {
            const Icon = cat.icon;
            const isActive = activeFilter === cat.id;
            const count = countByCategory(cat.id);

            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                onClick={() => onFilterChange(cat.id)}
                className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-300 group overflow-hidden ${
                  isActive
                    ? 'shadow-blue-md scale-[1.02]'
                    : 'card-white hover:shadow-card-hover hover:-translate-y-1'
                }`}
                style={
                  isActive
                    ? { borderColor: cat.color, backgroundColor: cat.bgLight }
                    : { borderColor: '#DBEAFE' }
                }
              >
                {/* Active indicator strip */}
                {isActive && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                    style={{ backgroundColor: cat.color }}
                  />
                )}

                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: isActive ? cat.bgDark : cat.bgLight }}
                >
                  <Icon size={20} style={{ color: cat.color }} />
                </div>

                {/* Label + Count */}
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-heading font-bold text-sm text-ink-800">{cat.label}</p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: cat.bgDark, color: cat.color }}
                  >
                    {count}
                  </span>
                </div>

                {/* Highlight tag */}
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: cat.color }}>
                  {cat.highlight}
                </p>

                {/* Description */}
                <p className="text-[11px] text-ink-400 leading-relaxed line-clamp-3">{cat.description}</p>

                {/* CTA row */}
                <div
                  className={`flex items-center gap-1 mt-3 text-[11px] font-semibold transition-colors ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  style={{ color: cat.color }}
                >
                  Browse {cat.id === 'all' ? 'All' : cat.label} <ArrowRight size={11} />
                </div>
              </motion.button>
            );
          })}
        </div>

      </div>
    </section>
  );
}
