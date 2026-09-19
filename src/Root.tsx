import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { locationSnapshot, subscribeNavigation } from './utils/navigation';
const Storefront = lazy(() => import('./App'));
const Admin = lazy(() => import('./admin/AdminApp'));
const Checkout = lazy(() => import('./components/sections/CheckoutPage'));
const PaymentReturn = lazy(() => import('./components/sections/PaymentReturn'));
function Route({ location }: { location: string }) {
  const path = location.split('?')[0];
  useEffect(() => {
    window.scrollTo({ top: window.history.state?.scrollY || 0, behavior: 'instant' });
  }, [location]);
  if (path === '/admin' || path.startsWith('/admin/')) return <Admin />;
  if (new URLSearchParams(location.split('?')[1]).get('payment') === 'return') return <PaymentReturn />;
  if (path === '/checkout' || path === '/buy') return <Checkout />;
  return <Storefront />;
}
export default function Root() {
  const location = useSyncExternalStore(subscribeNavigation, locationSnapshot);
  const reducedMotion = useReducedMotion();
  return <AnimatePresence mode="wait" initial={false}>
    <motion.div key={location} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
      <Suspense fallback={<div role="status" className="min-h-screen grid place-items-center bg-brand-50 text-brand-700">Loading QuickSub…</div>}>
        <Route location={location} />
      </Suspense>
    </motion.div>
  </AnimatePresence>;
}
