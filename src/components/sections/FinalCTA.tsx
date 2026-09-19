import { useStore } from '../../data/store';
import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle, Phone, Mail, Clock, Package } from 'lucide-react';

const contactMethods = [
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: 'Chat with us instantly',
    href: '/api/support/whatsapp?text=Hello%2C%20I%20need%20help%20with%20my%20QuickSub%20order.',
    cta: 'Open WhatsApp',
  },
  {
    icon: Phone,
    label: 'Phone',
    value: '+880 1758-277735',
    href: 'tel:+8801758277735',
    cta: 'Call Now',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'support@quicksub.com',
    href: 'mailto:support@quicksub.com',
    cta: 'Send Email',
  },
  {
    icon: Clock,
    label: 'Support Hours',
    value: '10 AM – 11 PM (GMT+6)',
    href: '#faq',
    cta: 'View FAQ',
  },
];

export default function FinalCTA() {
  const { settings } = useStore();
  return (
    <section id="contact" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 gradient-primary" />
      <div className="absolute inset-0 dot-grid opacity-10" />

      <div className="absolute top-1/4 left-10 w-64 h-64 bg-blue-300/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-10 w-64 h-64 bg-blue-800/30 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-bold uppercase tracking-wider mb-6">
            Get in Touch
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
            Ready to Upgrade Your Digital Life?
          </h2>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Choose your subscription or game top-up and place your order in a few simple steps. Our team is here to help.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        >
          {contactMethods.map(method => {
            const Icon = method.icon;
            return (
              <a
                key={method.label}
                href={method.href}
                target={method.href.startsWith('/api/support/whatsapp') ? '_blank' : undefined}
                rel={method.href.startsWith('/api/support/whatsapp') ? 'noopener noreferrer' : undefined}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 hover:bg-white/15 hover:border-white/30 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-3 group-hover:bg-white/25 transition-colors">
                  <Icon size={18} className="text-white" />
                </div>
                <p className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-1">{method.label}</p>
                <p className="text-sm font-semibold text-white mb-2">{method.label === 'Support Hours' ? settings.supportHours || method.value : method.value}</p>
                <span className="text-xs text-blue-200 group-hover:text-white transition-colors flex items-center gap-1">
                  {method.cta} <ArrowRight size={10} />
                </span>
              </a>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <a
            href="#products"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-brand-700 font-bold rounded-xl hover:bg-blue-50 hover:shadow-xl transition-all duration-200 text-base shadow-lg shadow-black/20"
          >
            Start Ordering <ArrowRight size={18} />
          </a>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('quicksub:open-chat'))}
            className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 hover:border-white/60 transition-all duration-200 text-base"
          >
            <MessageCircle size={18} /> Live Chat
          </button>
          <a
            href="#faq"
            className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/20 text-blue-100 font-semibold rounded-xl hover:bg-white/5 transition-all duration-200 text-base"
          >
            <Package size={18} /> Track Order
          </a>
        </motion.div>
      </div>
    </section>
  );
}
