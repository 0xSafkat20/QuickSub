import { type LucideIcon, Tv, Music, Gamepad2, Bot, Grid3X3 } from 'lucide-react';
import { categories } from '../../data/categories';

const iconMap: Record<string, LucideIcon> = {
  'grid-3x3': Grid3X3,
  'tv': Tv,
  'music': Music,
  'gamepad-2': Gamepad2,
  'bot': Bot,
};

interface CategoryStripProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function CategoryStrip({ activeFilter, onFilterChange }: CategoryStripProps) {
  return (
    <div className="bg-white border-b border-brand-100">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map(cat => {
            const Icon = iconMap[cat.icon] || Grid3X3;
            const isActive = activeFilter === cat.filter;
            return (
              <button
                key={cat.id}
                onClick={() => onFilterChange(cat.filter)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                  isActive
                    ? 'gradient-primary text-white shadow-blue-sm'
                    : 'bg-brand-50 text-ink-500 hover:bg-brand-100 hover:text-brand-700 border border-brand-100'
                }`}
              >
                <Icon size={16} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
