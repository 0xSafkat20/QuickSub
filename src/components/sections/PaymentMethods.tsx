import { paymentMethods } from '../../data/paymentMethods';
import { motion } from 'framer-motion';
import { Wallet, Smartphone, CreditCard, Landmark, Building2, Banknote } from 'lucide-react';

const icons = [Wallet, Smartphone, CreditCard, Landmark, Building2, Banknote];
const methods = paymentMethods.map((m, i) => ({ ...m, icon: icons[i], bg: m.color + '12' }));

export default function PaymentMethods() {
  return (
    <section className="py-14 bg-white border-y border-brand-50">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold uppercase tracking-wider mb-4">
            Secure Payments
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ink-900 mb-3">
            Trusted Payment Methods
          </h2>
          <p className="text-ink-400 max-w-xl mx-auto text-sm">
            Preview all six options in demo checkout. For real payments, available methods are shown by the payment provider or in the verified store instructions.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {methods.map((method, i) => {
            const Icon = method.icon;
            return (
              <motion.div
                key={method.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex flex-col items-center gap-2.5 py-5 px-3 rounded-2xl border-2 border-brand-50 hover:border-brand-200 hover:shadow-card transition-all duration-200 cursor-default group"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200"
                  style={{ backgroundColor: method.bg }}
                >
                  <Icon size={20} style={{ color: method.color }} />
                </div>
                <span className="text-xs font-semibold text-ink-600">{method.name}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
