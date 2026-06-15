import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { products } from '../data/products';

const STORAGE_KEY = 'quicksub-favorites';

interface WishlistContextType {
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  favoriteProducts: typeof products;
}

const WishlistContext = createContext<WishlistContextType>({
  favorites: [],
  toggleFavorite: () => {},
  isFavorite: () => false,
  favoriteProducts: [],
});

export function useWishlist() {
  return useContext(WishlistContext);
}

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }, []);

  const isFavorite = useCallback(
    (productId: string) => favorites.includes(productId),
    [favorites]
  );

  const favoriteProducts = products.filter(p => favorites.includes(p.id));

  return (
    <WishlistContext.Provider value={{ favorites, toggleFavorite, isFavorite, favoriteProducts }}>
      {children}
    </WishlistContext.Provider>
  );
}
