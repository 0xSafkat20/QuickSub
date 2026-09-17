import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Product } from '../data/products';
import { useProducts } from '../data/catalog';
import { safeStorageGet, safeStorageSet } from '../utils/storage';

const STORAGE_KEY = 'quicksub-favorites';

interface WishlistContextType {
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  favoriteProducts: Product[];
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
    const raw = safeStorageGet(STORAGE_KEY);
    const saved: unknown = raw ? JSON.parse(raw) : [];
    // Stored preferences are untrusted: malformed values must not crash the store.
    if (!Array.isArray(saved)) return [];
    return [...new Set(saved.filter((id): id is string =>
      typeof id === 'string' && id.length > 0 && id.length < 100
    ))];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const products = useProducts();
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);

  useEffect(() => {
    safeStorageSet(STORAGE_KEY, JSON.stringify(favorites));
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
