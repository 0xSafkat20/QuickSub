import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle } from 'lucide-react';

export default function FinalCTA() {
  return (
    <section id="contact" className="py-24 relative overflow-hidden">
      {/* Rich blue gradient background */}
      <div className="absolute inset-0 gradient-primary" />
      <div className="absolute inset-0 dot-grid opacity-10" />

      {/* Decorative orbs */}
      <div className="absolute top-1/4 left-10 w-64 h-64 bg-blue-300/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-10 w-64 h-64 bg-blue-800/30 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55 }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-bold uppercase tracking-wider mb-6">
            Ready to Order?
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
            Ready to Upgrade Your Digital Life?
          </h2>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-10">
            Choose your subscription or game top-up and place your order in a few simple steps.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#products"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-brand-700 font-bold rounded-xl hover:bg-blue-50 hover:shadow-xl transition-all duration-200 text-base shadow-lg shadow-black/20"
            >
              Start Ordering <ArrowRight size={18} />
            </a>
            <a
              href="#faq"
              className="inline-flex items-center gap-2 px-8 py-4 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 hover:border-white/60 transition-all duration-200 text-base"
            >
              <MessageCircle size={18} /> Ask a Question
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
