import { motion } from 'framer-motion';
import { Zap, Shield, ListChecks, Headset } from 'lucide-react';

const features = [
  {
    icon: Zap,
    headline: 'Fast Digital Delivery',
    copy: 'Orders are processed quickly after payment confirmation, with clear status updates from request to completion.',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    icon: Shield,
    headline: 'Secure & Clear Payment',
    copy: 'Transparent BDT pricing and guidance through safe local payment options — no hidden costs or surprises.',
    color: '#1D4ED8',
    bg: '#DBEAFE',
  },
  {
    icon: ListChecks,
    headline: 'Choose the Right Plan',
    copy: 'Not sure which subscription or top-up to buy? QuickSub support helps you before checkout.',
    color: '#7C3AED',
    bg: '#EDE9FE',
  },
  {
    icon: Headset,
    headline: 'Support When You Need It',
    copy: 'Live chat or FAQ assistance for order questions, renewal help, and delivery updates — always available.',
    color: '#0D9488',
    bg: '#F0FDFA',
  },
];

export default function TrustFeatures() {
  return (
    <section className="py-20 bg-page relative">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold uppercase tracking-wider mb-4">
            Why QuickSub?
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
            Built for Safe and Simple Digital Orders
          </h2>
          <p className="text-ink-400 max-w-2xl mx-auto">
            Every section reduces confusion, explains requirements clearly, and helps you complete orders without friction.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.headline}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="card-white card-white-hover rounded-2xl p-6 transition-all duration-300 group cursor-default"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200"
                  style={{ backgroundColor: feature.bg }}
                >
                  <Icon size={22} style={{ color: feature.color }} />
                </div>
                <h3 className="font-heading font-bold text-ink-800 mb-2 text-base">{feature.headline}</h3>
                <p className="text-sm text-ink-400 leading-relaxed">{feature.copy}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
