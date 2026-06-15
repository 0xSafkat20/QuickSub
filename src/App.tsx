import { useState } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Hero from './components/sections/Hero';
import StatsSection from './components/sections/StatsSection';
import TrustFeatures from './components/sections/TrustFeatures';
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

export default function App() {
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <CompareProvider>
      <div className="min-h-screen bg-page font-body">
        <ScrollProgress />
        <Header />

        <main>
          <Hero />
          <StatsSection />
          <TrustFeatures />
          <DealsSection />
          <ProductGrid activeFilter={activeFilter} onFilterChange={setActiveFilter} />
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
      </div>
    </CompareProvider>
  );
}
