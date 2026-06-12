export interface Category {
  id: string;
  label: string;
  filter: string;
  icon: string;
}

export const categories: Category[] = [
  { id: 'all', label: 'All Products', filter: 'all', icon: 'grid-3x3' },
  { id: 'streaming', label: 'Streaming', filter: 'streaming', icon: 'tv' },
  { id: 'music', label: 'Music', filter: 'music', icon: 'music' },
  { id: 'gaming', label: 'Gaming Top-Up', filter: 'gaming', icon: 'gamepad-2' },
  { id: 'ai', label: 'AI Tools', filter: 'ai', icon: 'bot' },
];
