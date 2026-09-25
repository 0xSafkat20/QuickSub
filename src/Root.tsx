import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { locationSnapshot, subscribeNavigation } from './utils/navigation';
import Seo from './components/ui/Seo';
const Storefront = lazy(() => import('./App'));
const Admin = lazy(() => import('./admin/AdminApp'));
const Checkout = lazy(() => import('./components/sections/CheckoutPage'));
const PaymentReturn = lazy(() => import('./components/sections/PaymentReturn'));
const Tracking = lazy(() => import('./components/sections/TrackingPage'));
const PasswordRecovery = lazy(() => import('./components/sections/PasswordRecovery'));
const Cart = lazy(() => import('./components/sections/CartPage'));
const Account = lazy(() => import('./components/sections/AccountPage'));
const Subscription = lazy(() => import('./components/sections/SubscriptionPage'));
function Route({ location }: { location: string }) {
  const path = location.split(/[?#]/)[0];
  useEffect(() => {
    const scroll = () => {
      let id = window.location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* Ignore malformed fragment encoding. */ }
      const target = id ? document.getElementById(id) : null;
      if (target) { target.scrollIntoView({behavior:'instant'}); return true; }
      if (!id) { window.scrollTo({top:window.history.state?.scrollY || 0,behavior:'instant'}); return true; }
      return false;
    };
    const frame = requestAnimationFrame(scroll);
    const observer = new MutationObserver(() => { if(scroll())observer.disconnect(); });
    if(window.location.hash) observer.observe(document.body,{childList:true,subtree:true});
    const timer = window.setTimeout(()=>observer.disconnect(),5000);
    return () => {cancelAnimationFrame(frame);observer.disconnect();clearTimeout(timer);};
  }, [location]);
  if (path === '/forgot-password') return <PasswordRecovery />;
  if (path === '/reset-password') return <PasswordRecovery reset />;
  if (path === '/track') return <Tracking />;
  if (path === '/cart') return <Cart />;
  if (path === '/account') return <Account />;
  if (/^\/subscriptions\/[a-f0-9-]{36}$/i.test(path)) return <Subscription />;
  if (path === '/admin' || path.startsWith('/admin/')) return <Admin />;
  if (new URL(window.location.href).searchParams.get('payment') === 'return') return <PaymentReturn />;
  if (path === '/checkout' || path === '/buy') return <Checkout />;
  return <Storefront />;
}
export default function Root() {
  const location = useSyncExternalStore(subscribeNavigation, locationSnapshot);
  const reducedMotion = useReducedMotion();
  const path = location.split(/[?#]/)[0];
  return <><Seo path={path}/><AnimatePresence mode="wait" initial={false}>
    <motion.div key={location.split('#')[0]} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
      <Suspense fallback={<div role="status" className="min-h-screen grid place-items-center bg-brand-50 text-brand-700">Loading QuickSub…</div>}>
        <Route location={location} />
      </Suspense>
    </motion.div>
  </AnimatePresence></>;
}
