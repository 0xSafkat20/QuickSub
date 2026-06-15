import { useState, useCallback } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Hero from './components/sections/Hero';
import StatsSection from './components/sections/StatsSection';
import TrustFeatures from './components/sections/TrustFeatures';
import CategorySection from './components/sections/CategorySection';
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
import type { Product } from './data/products';

export default function App() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);

  const handleFilterChange = useCallback((filter: string) => {
    setActiveFilter(filter);
    requestAnimationFrame(() => {
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const handleSearchSelect = useCallback((product: Product) => {
    setHighlightProductId(product.id);
    setTimeout(() => setHighlightProductId(null), 3000);
  }, []);

  return (
    <WishlistProvider>
      <CompareProvider>
        <div className="min-h-screen bg-page font-body">
          <ScrollProgress />
          <Header
            onSearchOpen={() => setSearchOpen(true)}
            onWishlistOpen={() => setWishlistOpen(true)}
          />

          <main>
            <Hero />
            <StatsSection />
            <TrustFeatures />
            <CategorySection activeFilter={activeFilter} onFilterChange={handleFilterChange} />
            <DealsSection />
            <CategoryStrip activeFilter={activeFilter} onFilterChange={handleFilterChange} />
            <ProductGrid
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              highlightProductId={highlightProductId}
            />
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
