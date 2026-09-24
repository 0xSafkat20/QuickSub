export type CartItem = {
 package_id: string; product_id: string; product_name: string; package_name: string;
 price_bdt: number; available: boolean; name: string; contact: string; note: string; updated_at: string;
};
export type CartResponse = { items: CartItem[]; limit: number };
export const cartCheckoutUrl = (item: CartItem) => `/checkout?product=${encodeURIComponent(item.product_id)}&package=${encodeURIComponent(item.package_id)}&cart=1&saved=${encodeURIComponent(item.updated_at)}`;
