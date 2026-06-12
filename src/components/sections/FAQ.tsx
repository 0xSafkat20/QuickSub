import { useState } from 'react';
import { motion } from 'framer-motion';
import { faqItems } from '../../data/faq';
import { ChevronDown, MessageCircle, HelpCircle } from 'lucide-react';

function AccordionItem({ item, isOpen, onToggle, index }: {
  item: typeof faqItems[0];
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isOpen ? 'border-brand-300 shadow-blue-sm' : 'card-white hover:border-brand-200'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left bg-white"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-ink-800 pr-4">{item.question}</span>
        <ChevronDown
          size={18}
          className={`text-brand-400 flex-shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 pb-5 bg-white">
          <p className="text-sm text-ink-400 leading-relaxed">{item.answer}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function FAQ() {
  const [openId, setOpenId] = useState<string | null>('1');

  return (
    <section id="faq" className="py-20 bg-page">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid lg:grid-cols-5 gap-10">
          {/* FAQ Accordion */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <span className="inline-block px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold uppercase tracking-wider mb-4">
                FAQ
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
                Questions Before Ordering?
              </h2>
              <p className="text-ink-400">
                Check common answers or use the chatbot for guided help.
              </p>
            </motion.div>

            <div className="space-y-3">
              {faqItems.map((item, i) => (
                <AccordionItem
                  key={item.id}
                  item={item}
                  isOpen={openId === item.id}
                  onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                  index={i}
                />
              ))}
            </div>
          </div>

          {/* Support Card */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="sticky top-24"
            >
              {/* Chat Card */}
              <div className="rounded-2xl overflow-hidden border border-brand-200 shadow-blue-sm mb-5">
                <div className="gradient-primary p-6">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                    <MessageCircle size={26} className="text-white" />
                  </div>
                  <h3 className="font-heading font-bold text-white text-xl mb-2">Need Quick Help?</h3>
                  <p className="text-sm text-blue-100 leading-relaxed">
                    Our chatbot can help you choose products, track orders, and answer common questions.
                  </p>
                </div>
                <div className="bg-white p-5">
                  <button className="w-full px-4 py-3 gradient-primary text-white text-sm font-semibold rounded-xl hover:shadow-blue-md transition-all">
                    Start Chat
                  </button>
                  <p className="text-xs text-ink-300 text-center mt-3">
                    Available for order tracking, product questions, and renewal help
                  </p>
                </div>
              </div>

              {/* Still have questions? */}
              <div className="card-white rounded-2xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <HelpCircle size={18} className="text-brand-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-800 mb-1">Still have questions?</p>
                  <p className="text-xs text-ink-400 leading-relaxed">
                    Contact support through WhatsApp, Messenger, email, or the contact form.
                  </p>
                  <a href="#contact" className="inline-block mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700">
                    Contact Us →
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map(item => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }),
        }}
      />
    </section>
  );
}
