import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';

export default function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('quicksub-dark') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('quicksub-dark', String(dark));
  }, [dark]);

  return [dark, setDark] as const;
}

export function DarkModeToggle({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  return (
    <button
      onClick={() => setDark(!dark)}
      className={`p-2 rounded-lg transition-colors ${
        dark ? 'text-yellow-300 hover:bg-white/10' : 'text-ink-400 hover:text-brand-600 hover:bg-brand-50'
      }`}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <AnimatePresence mode="wait" initial={false}>
        {dark ? (
          <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Sun size={18} />
          </motion.div>
        ) : (
          <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Moon size={18} />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
