import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon, Users, ShoppingBag, Clock, Star } from 'lucide-react';

const stats = [
  { icon: Users,       value: 10000, suffix: '+', label: 'Happy Customers', color: '#2563EB' },
  { icon: ShoppingBag, value: 13, suffix: '+', label: 'Products Available', color: '#7C3AED' },
  { icon: Clock,       value: 30,    suffix: ' min', label: 'Avg Delivery Time', color: '#D97706' },
  { icon: Star,        value: 98,    suffix: '%',  label: 'Satisfaction Rate', color: '#16A34A' },
];

function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, start]);
  return value;
}

function StatCard({ icon: Icon, value, suffix, label, color, index, inView }: {
  icon: LucideIcon;
  value: number;
  suffix: string;
  label: string;
  color: string;
  index: number;
  inView: boolean;
}) {
  const count = useCountUp(value, 1800, inView);
  const display = value >= 1000 ? (count >= 1000 ? `${Math.floor(count / 1000)}K` : count.toString()) : count.toString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: index * 0.1 }}
      className="card-white rounded-2xl p-7 text-center hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 group"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200"
        style={{ backgroundColor: `${color}12` }}
      >
        <Icon size={26} style={{ color }} />
      </div>
      <p
        className="font-heading text-4xl font-extrabold mb-1.5 tabular-nums"
        style={{ color }}
      >
        {display}{suffix}
      </p>
      <p className="text-sm text-ink-400 font-medium">{label}</p>
    </motion.div>
  );
}

export default function StatsSection() {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.2 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-ink-900">
            QuickSub by the Numbers
          </h2>
          <p className="text-ink-400 mt-2 text-sm">Trusted by digital users across Bangladesh</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((s, i) => (
            <StatCard key={s.label} {...s} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
