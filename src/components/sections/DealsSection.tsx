import { useStore } from '../../data/store';
import { useState, useEffect } from 'react';
import { useProducts } from '../../data/catalog';
import { motion } from 'framer-motion';
import { Flame, Clock, ArrowRight } from 'lucide-react';

const deals = [
  { name: 'Spotify Premium', discount: '25%', oldPrice: '৳199', newPrice: '৳149', color: '#1DB954', slug: 'spotify-premium' },
  { name: 'YouTube Premium', discount: '20%', oldPrice: '৳225', newPrice: '৳179', color: '#FF0000', slug: 'youtube-premium' },
  { name: 'PUBG UC 660', discount: '15%', oldPrice: '৳235', newPrice: '৳199', color: '#F59E0B', slug: 'pubg-uc' },
  { name: 'ChatGPT Plus', discount: '10%', oldPrice: '৳550', newPrice: '৳499', color: '#10A37F', slug: 'chatgpt-subscription' },
];

// One-month campaign, ending October 10 in Bangladesh time.
const DEAL_END_TIME = new Date('2026-10-10T23:59:59+06:00').getTime();

function useCountdown(targetTime: number) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      };
    };
    setTimeLeft(tick());
    if (targetTime <= Date.now()) return;
    const id = setInterval(() => {
      setTimeLeft(tick());
      if (targetTime <= Date.now()) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  return timeLeft;
}

export default function DealsSection() {
  const products = useProducts();
  const { settings } = useStore();
  const deadline = settings.dealEndsAt ? Date.parse(settings.dealEndsAt) : DEAL_END_TIME;
  const configuredDeals = settings.deals === undefined ? deals : settings.deals.flatMap(d => {
    const p = products.find(p=>p.id===d.productId);
    return p ? [{name:p.name,discount:'',oldPrice:'৳'+d.oldPrice,newPrice:'',color:p.accentColor,slug:p.slug}] : [];
  });
  const currentDeals = configuredDeals.flatMap(deal => {
    const product = products.find(p => p.slug === deal.slug && !p.outOfStock);
    if (!product) return [];
    const price = Number(product.startingPrice.replace(/[^\d.]/g, ''));
    const oldPrice = Number(deal.oldPrice.replace(/[^\d.]/g, ''));
    if (price >= oldPrice) return [];
    return [{ ...deal, name: product.name, newPrice: '৳' + price, discount: Math.round((1 - price / oldPrice) * 100) + '%' }];
  });
  const { days, hours, minutes, seconds } = useCountdown(deadline);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section id="deals" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wider mb-4">
            <Flame size={12} /> Limited Time Offers
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
            Today's Best Deals
          </h2>
          <p className="text-ink-400 max-w-xl mx-auto">
            Grab these exclusive discounts before they expire. New deals every month.
          </p>
        </motion.div>

        {/* Countdown */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mb-12 flex-wrap">
          {[
            { value: pad(days), label: 'Days' },
            { value: pad(hours), label: 'Hours' },
            { value: pad(minutes), label: 'Min' },
            { value: pad(seconds), label: 'Sec' },
          ].map((unit, i) => (
            <div key={unit.label} className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-lg sm:rounded-2xl bg-brand-600 text-white flex items-center justify-center font-heading font-extrabold text-lg sm:text-2xl md:text-3xl shadow-lg">
                  {unit.value}
                </div>
                <span className="text-[8px] sm:text-[10px] text-ink-400 font-semibold uppercase tracking-wider mt-1 sm:mt-2">{unit.label}</span>
              </div>
              {i < 3 && <span className="text-brand-300 font-bold text-base sm:text-lg md:text-xl mb-3 sm:mb-4 md:mb-5">:</span>}
            </div>
          ))}
        </div>

        {/* Deal cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {currentDeals.map((deal, i) => (
            <motion.div
              key={deal.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="bg-white rounded-2xl border-2 border-brand-100 p-5 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="px-3 py-1 rounded-lg text-xs font-extrabold uppercase text-white"
                  style={{ backgroundColor: deal.color }}
                >
                  {deal.discount} OFF
                </span>
                <Clock size={14} className="text-ink-300" />
              </div>

              <h3 className="font-heading font-bold text-lg text-ink-900 mb-2">{deal.name}</h3>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-ink-300 line-through">{deal.oldPrice}</span>
                <span className="font-heading font-extrabold text-xl" style={{ color: deal.color }}>{deal.newPrice}</span>
              </div>

              <a
                href={`/buy?text=${encodeURIComponent(`Hi, I want to order ${deal.name} at the deal price of ${deal.newPrice}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-200 group-hover:text-white"
                style={{ borderColor: deal.color, color: deal.color }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = deal.color;
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = deal.color;
                }}
              >
                Grab Deal <ArrowRight size={13} />
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
