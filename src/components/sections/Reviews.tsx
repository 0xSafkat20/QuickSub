import { useState } from 'react';
import { motion } from 'framer-motion';
import { reviews } from '../../data/reviews';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-ink-100'}
        />
      ))}
    </div>
  );
}

const avatarColors = ['#2563EB', '#7C3AED', '#D97706', '#16A34A', '#0D9488'];

export default function Reviews() {
  const [current, setCurrent] = useState(0);

  const perView = 3;
  const max = Math.max(0, reviews.length - perView);

  return (
    <section id="reviews" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold uppercase tracking-wider mb-4">
            Customer Reviews
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-ink-900 mb-4">
            Trusted by Digital Users and Gamers
          </h2>
          <p className="text-ink-400 max-w-xl mx-auto">
            Here's what customers say about ordering through QuickSub.
          </p>
        </motion.div>

        <div className="relative overflow-hidden">
          <div
            className="flex gap-6 transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${current * (100 / perView + 0.7)}%)` }}
          >
            {reviews.map((review, i) => (
              <div
                key={review.id}
                className="flex-shrink-0"
                style={{ width: `calc(${100 / perView}% - ${(perView - 1) * 24 / perView}px)` }}
              >
                <motion.blockquote
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="card-white rounded-2xl p-6 h-full flex flex-col hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                >
                  <Quote size={28} className="text-brand-200 mb-4 flex-shrink-0" />
                  <StarRating rating={review.rating} />
                  <p className="text-sm text-ink-500 leading-relaxed mt-4 mb-6 flex-1">
                    &ldquo;{review.review}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-brand-50">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: avatarColors[i % avatarColors.length] }}
                    >
                      {review.initials}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink-800">{review.name}</p>
                      {review.product && (
                        <p className="text-xs text-ink-300">{review.product}</p>
                      )}
                    </div>
                  </div>
                </motion.blockquote>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className="w-10 h-10 rounded-xl card-white flex items-center justify-center text-ink-400 hover:text-brand-600 hover:border-brand-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-2">
            {Array.from({ length: max + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current ? 'w-6 bg-brand-600' : 'w-2 bg-brand-200 hover:bg-brand-300'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrent(c => Math.min(max, c + 1))}
            disabled={current === max}
            className="w-10 h-10 rounded-xl card-white flex items-center justify-center text-ink-400 hover:text-brand-600 hover:border-brand-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Next"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
