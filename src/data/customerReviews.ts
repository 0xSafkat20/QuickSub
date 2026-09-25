import { useCallback, useEffect, useState } from 'react';
import { api } from '../utils/api';

export type CustomerReview = {
  id: string;
  product_id: string;
  product_name: string;
  display_name: string;
  rating: number;
  comment: string;
  created_at: string;
  verifiedPurchase: true;
};

export function useCustomerReviews(productId?: string, enabled = true) {
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [summary, setSummary] = useState({ count: 0, average: 0 });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const suffix = productId ? `?productId=${encodeURIComponent(productId)}` : '';
      const result = await api<{reviews: CustomerReview[]; summary: {count: number; average: number}}>(`/reviews${suffix}`);
      setReviews(result.reviews);
      setSummary(result.summary);
    } catch {
      setReviews([]);
      setSummary({ count: 0, average: 0 });
    } finally { setLoading(false); }
  }, [productId]);
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    void load();
    const refresh = () => void load();
    window.addEventListener('quicksub:review-saved', refresh);
    return () => window.removeEventListener('quicksub:review-saved', refresh);
  }, [load, enabled]);
  return { reviews, summary, loading, refresh: load };
}
