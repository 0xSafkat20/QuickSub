import { refreshStore } from './data/store';
import { useState, useCallback, useEffect } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Hero from './components/sections/Hero';
import StatsSection from './components/sections/StatsSection';
import TrustFeatures from './components/sections/TrustFeatures';
import CategoryStrip from './components/sections/CategoryStrip';
import DealsSection from './components/sections/DealsSection';
import ProductGrid from './components/sections/ProductGrid';
import PaymentMethods from './components/sections/PaymentMethods';
import PromoBanner from './components/sections/PromoBanner';
import HowItWorks from './components/sections/HowItWorks';
import Reviews from './components/sections/Reviews';
import FAQ from './components/sections/FAQ';
import FinalCTA from './components/sections/FinalCTA';
import Chatbot from './components/chatbot/Chatbot';
import BackToTop from './components/ui/BackToTop';
import ScrollProgress from './components/ui/ProgressBar';
import CompareDrawer, { CompareProvider } from './components/sections/CompareDrawer';
import SearchModal from './components/ui/SearchModal';
import WishlistDrawer from './components/ui/WishlistDrawer';
import CookieConsent from './components/ui/CookieConsent';
import LegalModal from './components/ui/LegalModal';
import { WishlistProvider } from './context/WishlistContext';
import { refreshProducts } from './data/catalog';
import type { Product } from './data/products';

export default function App() {
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { void refreshProducts(); void refreshStore(); } };
    refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [searchSelection, setSearchSelection] = useState<{ id: string } | null>(null);

  const handleFilterChange = useCallback((filter: string) => {
    setActiveFilter(filter);
    requestAnimationFrame(() => {
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const handleSearchSelect = useCallback((product: Product) => {
    setActiveFilter('all');
    setSearchQuery('');
    setInStockOnly(false);
    setSearchSelection({ id: product.id });
  }, []);

  useEffect(() => {
    if (!searchSelection) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`product-${searchSelection.id}`)?.scrollIntoView({
        behavior: 'smooth', block: 'center',
      });
    });
    const timeout = setTimeout(() => setSearchSelection(null), 3000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [searchSelection]);

  return (
    <WishlistProvider>
      <CompareProvider>
        <div className="min-h-screen bg-page font-body overflow-x-clip">
          <ScrollProgress />
          <Header
            onSearchOpen={() => setSearchOpen(true)}
            onWishlistOpen={() => setWishlistOpen(true)}
          />

          <main>
            <Hero />
            <StatsSection />

            <DealsSection />
            <CategoryStrip activeFilter={activeFilter} onFilterChange={handleFilterChange} />
            <ProductGrid
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              highlightProductId={searchSelection?.id}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              inStockOnly={inStockOnly}
              onInStockOnlyChange={setInStockOnly}
            />

            <TrustFeatures />
            <PaymentMethods />
            <PromoBanner />
            <HowItWorks />
            <Reviews />
            <FAQ />
            <FinalCTA />
          </main>

          <Footer />
          <Chatbot />
          <BackToTop />
          <CompareDrawer />
          <SearchModal
            open={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelectProduct={handleSearchSelect}
          />
          <WishlistDrawer open={wishlistOpen} onClose={() => setWishlistOpen(false)} />
          <CookieConsent />
          <LegalModal />
        </div>
      </CompareProvider>
    </WishlistProvider>
  );
}
