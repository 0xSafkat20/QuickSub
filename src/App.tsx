import { useState } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Hero from './components/sections/Hero';
import StatsSection from './components/sections/StatsSection';
import TrustFeatures from './components/sections/TrustFeatures';
import CategorySection from './components/sections/CategorySection';
import ProductGrid from './components/sections/ProductGrid';
import PromoBanner from './components/sections/PromoBanner';
import HowItWorks from './components/sections/HowItWorks';
import Reviews from './components/sections/Reviews';
import FAQ from './components/sections/FAQ';
import FinalCTA from './components/sections/FinalCTA';
import Chatbot from './components/chatbot/Chatbot';

export default function App() {
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <div className="min-h-screen bg-page font-body">
      <Header />

      <main>
        <Hero />
        <StatsSection />
        <TrustFeatures />
        <CategorySection activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <ProductGrid activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <PromoBanner />
        <HowItWorks />
        <Reviews />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
      <Chatbot />
    </div>
  );
}
