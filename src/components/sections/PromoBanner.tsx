import { motion } from 'framer-motion';
import { Package, Gamepad2, Lightbulb, ArrowRight, Sparkles } from 'lucide-react';

const bundles = [
  {
    icon: Package,
    name: 'Entertainment Bundle',
    desc: 'Netflix Premium + Spotify Premium',
    cta: 'View Bundle',
    from: '#2563EB',
    to: '#1D4ED8',
    light: '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    icon: Gamepad2,
    name: 'Gaming Top-Up Bundle',
    desc: 'PUBG UC + Freefire Diamonds + Mobile Legend Coins',
    cta: 'Explore Gaming Deals',
    from: '#F59E0B',
    to: '#D97706',
    light: '#FFFBEB',
    border: '#FDE68A',
  },
  {
    icon: Lightbulb,
    name: 'Productivity Bundle',
    desc: 'ChatGPT Subscription + Spotify Premium',
    cta: 'Ask for Offer',
    from: '#10A37F',
    to: '#0D9488',
    light: '#F0FDFA',
    border: '#99F6E4',
  },
];

export default function PromoBanner() {
  return (
    <section className="py-16 bg-page relative overflow-hidden">
      {/* Decorative background circles */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-50 rounded-full opacity-60" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-100 rounded-full opacity-40" />

      <div className="relative max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={11} /> Limited Offers
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
            Bundle More. Save More.
          </h2>
          <p className="text-ink-400 max-w-2xl mx-auto">
            Combine entertainment, gaming, and AI subscriptions in one order for a smoother digital experience.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {bundles.map((bundle, i) => {
            const Icon = bundle.icon;
            return (
              <motion.div
                key={bundle.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: i * 0.12 }}
                className="rounded-2xl border-2 p-7 hover:-translate-y-1.5 transition-all duration-300 shadow-card hover:shadow-card-hover group"
                style={{ backgroundColor: bundle.light, borderColor: bundle.border }}
              >
                <div
                  className="w-13 h-13 w-12 h-12 rounded-xl flex items-center justify-center mb-5 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${bundle.from}, ${bundle.to})` }}
                >
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="font-heading font-bold text-ink-900 text-lg mb-2">{bundle.name}</h3>
                <p className="text-sm text-ink-500 mb-6">{bundle.desc}</p>
                <button
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-md"
                  style={{ background: `linear-gradient(135deg, ${bundle.from}, ${bundle.to})` }}
                >
                  {bundle.cta} <ArrowRight size={14} />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
