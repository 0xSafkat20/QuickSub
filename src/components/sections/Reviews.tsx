import { useState, useEffect } from 'react';
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
  const [perView, setPerView] = useState(3);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setPerView(1);
      } else if (window.innerWidth < 1024) {
        setPerView(2);
      } else {
        setPerView(3);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset current index when perView changes and current exceeds max
  useEffect(() => {
    const maxIndex = Math.max(0, reviews.length - perView);
    if (current > maxIndex) {
      setCurrent(maxIndex);
    }
  }, [perView, current]);

  return (
    <section id="reviews" className="py-12 sm:py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 sm:mb-10 md:mb-12"
        >
          <span className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4">
            Customer Reviews
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-ink-900 mb-3 sm:mb-4">
            Trusted by Digital Users and Gamers
          </h2>
          <p className="text-ink-400 text-sm sm:text-base max-w-xl mx-auto">
            Here's what customers say about ordering through QuickSub.
          </p>
        </motion.div>

        <div className="relative overflow-hidden">
          <div
            className="flex gap-4 sm:gap-5 md:gap-6 transition-transform duration-500 ease-out"
            style={{ 
              transform: `translateX(calc(-${current} * (${100 / perView}% + ${perView === 1 ? '0px' : perView === 2 ? '10px' : '12px'})))`
            }}
          >
            {reviews.map((review, i) => (
              <div
                key={review.id}
                className="flex-shrink-0"
                style={{ width: `calc(${100 / perView}% - ${(perView - 1) * 16 / perView}px)` }}
              >
                <motion.blockquote
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="card-white rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 h-full flex flex-col hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                >
                  <Quote size={24} className="text-brand-200 mb-3 sm:mb-4 flex-shrink-0" />
                  <StarRating rating={review.rating} />
                  <p className="text-xs sm:text-sm text-ink-500 leading-relaxed mt-3 sm:mt-4 mb-4 sm:mb-6 flex-1">
                    &ldquo;{review.review}&rdquo;
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-brand-50">
                    <div
                      className="w-8 sm:w-10 h-8 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: avatarColors[i % avatarColors.length] }}
                    >
                      {review.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-ink-800 truncate">{review.name}</p>
                      {review.product && (
                        <p className="text-[10px] sm:text-xs text-ink-300 truncate">{review.product}</p>
                      )}
                    </div>
                  </div>
                </motion.blockquote>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl card-white flex items-center justify-center text-ink-400 hover:text-brand-600 hover:border-brand-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous"
          >
            <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
          <div className="flex gap-1 sm:gap-2">
            {Array.from({ length: Math.max(0, reviews.length - perView + 1) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  i === current ? 'w-5 sm:w-6 bg-brand-600' : 'w-1.5 sm:w-2 bg-brand-200 hover:bg-brand-300'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrent(c => Math.min(Math.max(0, reviews.length - perView), c + 1))}
            disabled={current === Math.max(0, reviews.length - perView)}
            className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl card-white flex items-center justify-center text-ink-400 hover:text-brand-600 hover:border-brand-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Next"
          >
            <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>
      </div>
    </section>
  );
}
