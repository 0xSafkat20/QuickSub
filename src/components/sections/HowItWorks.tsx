import { motion } from 'framer-motion';
import { MousePointerClick, ClipboardList, CreditCard, Bell } from 'lucide-react';

const steps = [
  {
    icon: MousePointerClick,
    step: '01',
    headline: 'Choose Your Product',
    copy: 'Select the subscription or game currency package you want from the QuickSub product list.',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    icon: ClipboardList,
    step: '02',
    headline: 'Submit Required Details',
    copy: 'Enter the required account, player, or contact details carefully so the order can be processed correctly.',
    color: '#7C3AED',
    bg: '#EDE9FE',
  },
  {
    icon: CreditCard,
    step: '03',
    headline: 'Complete Payment',
    copy: 'Pay using the available payment methods and submit your payment confirmation if required.',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    icon: Bell,
    step: '04',
    headline: 'Receive Delivery Update',
    copy: 'Get order updates through your selected contact method and reach support if you need help.',
    color: '#16A34A',
    bg: '#F0FDF4',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-page">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold uppercase tracking-wider mb-4">
            Simple Process
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
            How QuickSub Works
          </h2>
          <p className="text-ink-400 max-w-2xl mx-auto">
            A simple ordering process designed for speed, clarity, and support.
          </p>
        </motion.div>

        {/* Desktop: Horizontal Timeline */}
        <div className="hidden md:grid grid-cols-4 gap-6 relative">
          {/* Connector Line */}
          <div className="absolute top-10 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-brand-200 via-brand-300 to-brand-200" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.headline}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: i * 0.15 }}
                className="flex flex-col items-center text-center"
              >
                {/* Step circle */}
                <div className="relative mb-5 z-10">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-card border-2 border-white"
                    style={{ backgroundColor: step.bg }}
                  >
                    <Icon size={26} style={{ color: step.color }} />
                  </div>
                  <span
                    className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full text-[11px] font-extrabold text-white flex items-center justify-center shadow-md"
                    style={{ backgroundColor: step.color }}
                  >
                    {step.step}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-ink-800 mb-2 text-base">{step.headline}</h3>
                <p className="text-sm text-ink-400 leading-relaxed">{step.copy}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Mobile: Vertical Steps */}
        <div className="flex md:hidden flex-col gap-0">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.headline}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="flex gap-5"
              >
                <div className="flex flex-col items-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm relative"
                    style={{ backgroundColor: step.bg }}
                  >
                    <Icon size={20} style={{ color: step.color }} />
                    <span
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center"
                      style={{ backgroundColor: step.color }}
                    >
                      {step.step}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-0.5 flex-1 my-2" style={{ backgroundColor: `${step.color}30` }} />
                  )}
                </div>
                <div className="pb-8">
                  <h3 className="font-heading font-bold text-ink-800 mb-1">{step.headline}</h3>
                  <p className="text-sm text-ink-400 leading-relaxed">{step.copy}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
