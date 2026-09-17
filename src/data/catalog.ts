import { useSyncExternalStore } from 'react';
import { products as bundled, type Product } from './products';

let products: Product[] = bundled;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function useProducts() {
  return useSyncExternalStore(subscribe, () => products, () => bundled);
}

export function refreshProducts() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch('/api/products', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.products) || !data.products.every((p: Product) => p &&
        ['id','name','slug','shortDescription','cardCopy','startingPrice','deliveryEstimate','cta','icon','bannerImage','accentColor'].every(k => typeof p[k as keyof Product] === 'string') &&
        ['streaming','music','gaming','ai'].includes(p.category) && Array.isArray(p.badges) && p.badges.every(b => typeof b === 'string') &&
        (p.soldItems === undefined || (Array.isArray(p.soldItems) && p.soldItems.every(s => s && typeof s.name === 'string' && Number.isFinite(s.count)))))) return;
      if (JSON.stringify(products) === JSON.stringify(data.products)) return;
      products = data.products;
      listeners.forEach(listener => listener());
    } catch {
      // Keep the visible catalog usable when the backend or network is blocked.
    }
  })().finally(() => { pending = undefined; });
  return pending;
}
