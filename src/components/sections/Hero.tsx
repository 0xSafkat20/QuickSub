import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, MessageCircle, Clock, Tv, Music, Crosshair, Bot, CheckCircle2, ArrowRight, Zap, Star } from 'lucide-react';

const floatingProducts = [
  { name: 'Netflix',   icon: Tv,       color: '#E50914', price: '৳299',  delay: 0,   x: 'left-0',  y: 'top-4'   },
  { name: 'Spotify',   icon: Music,    color: '#1DB954', price: '৳149',  delay: 0.6, x: 'right-4', y: 'top-0'   },
  { name: 'PUBG UC',   icon: Crosshair,color: '#F59E0B', price: '৳199',  delay: 1.2, x: 'left-8',  y: 'bottom-8'},
  { name: 'ChatGPT',   icon: Bot,      color: '#10A37F', price: '৳499',  delay: 1.8, x: 'right-0', y: 'bottom-4'},
];

const stats = [
  { label: 'Happy Customers', value: '10,000+' },
  { label: 'Products Available', value: '13+' },
  { label: 'Avg Delivery', value: '<1 hour' },
];

const progressSteps = ['Product Selected', 'Payment Verified', 'Processing', 'Completed'];

export default function Hero() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrentStep(s => (s + 1) % 4), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      id="home"
      className="relative min-h-[100vh] overflow-hidden flex items-center pt-24 pb-16 gradient-hero-2"
    >
      {/* Dot grid overlay */}
      <div className="absolute inset-0 dot-grid opacity-10" />

      {/* Animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl animate-pulse-blue" />
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-brand-300/15 rounded-full blur-3xl" style={{ animationDelay: '1.5s' }} />

      <div className="relative max-w-7xl mx-auto px-4 w-full">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* ── Left: Text Content ───────────────────────── */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold mb-6">
                <Zap size={12} className="text-yellow-300" /> Digital Subscriptions & Gaming Top-Ups
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="font-heading text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.15] text-white mb-6"
            >
              Premium Digital Access,{' '}
              <span className="relative inline-block">
                <span className="text-yellow-300">Delivered the Quick Way.</span>
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="6"
                  viewBox="0 0 300 6"
                  fill="none"
                >
                  <path
                    d="M2 4 C50 1 250 1 298 4"
                    stroke="#FDE047"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="animate-wave"
                  />
                </svg>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="text-lg text-blue-100 leading-relaxed mb-9 max-w-xl"
            >
              QuickSub brings your favorite streaming subscriptions, gaming currencies, and AI tools into one simple digital store. Browse, choose, pay securely, and get support when you need it.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="flex flex-wrap gap-3 mb-8"
            >
              <a
                href="#products"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-brand-700 font-bold rounded-xl hover:bg-blue-50 hover:shadow-blue-lg transition-all duration-200 text-sm shadow-lg shadow-black/20"
              >
                Browse Products <ArrowRight size={16} />
              </a>
              <a
                href="#faq"
                className="inline-flex items-center gap-2 px-7 py-3.5 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 hover:border-white/60 transition-all duration-200 text-sm"
              >
                <MessageCircle size={16} /> Chat Support
              </a>
            </motion.div>

            {/* Trust chips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.45 }}
              className="flex flex-wrap gap-3 text-xs text-white/70"
            >
              {[
                { icon: Clock,   label: 'Fast Processing'  },
                { icon: Shield,  label: 'BDT Pricing'      },
                { icon: Zap,     label: 'Secure Order Flow' },
                { icon: Star,    label: 'Support Available' },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <Icon size={12} className="text-yellow-300/80" /> {label}
                </span>
              ))}
            </motion.div>

            {/* Stats Row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.6 }}
              className="flex gap-6 mt-9 pt-9 border-t border-white/15"
            >
              {stats.map(s => (
                <div key={s.label}>
                  <p className="font-heading text-2xl font-extrabold text-white">{s.value}</p>
                  <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: Floating Cards + Progress Widget ─── */}
          <div className="hidden lg:block relative">
            {/* Centre circle decoration */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 rounded-full border-2 border-white/10" />
              <div className="absolute w-80 h-80 rounded-full border border-white/5" />
            </div>

            {/* Floating product cards */}
            <div className="relative h-[420px]">
              {floatingProducts.map((p, i) => {
                const Icon = p.icon;
                return (
                  <motion.div
                    key={p.name}
                    className={`absolute ${p.x} ${p.y}`}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.15 }}
                  >
                    <div
                      className="w-36 bg-white rounded-2xl p-4 shadow-xl border border-brand-100 hover:-translate-y-2 transition-all duration-300 cursor-pointer"
                      style={{ animation: `float ${6 + i}s ease-in-out ${p.delay}s infinite` }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: `${p.color}18` }}
                      >
                        <Icon size={20} style={{ color: p.color }} />
                      </div>
                      <p className="text-sm font-bold text-ink-800">{p.name}</p>
                      <p className="text-xs font-semibold mt-1" style={{ color: p.color }}>{p.price}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <span className="w-2 h-2 rounded-full bg-accent-green" />
                        <span className="text-[10px] text-ink-300">Available</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Central hero image area */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className="w-52 bg-white/15 backdrop-blur-md border border-white/25 rounded-3xl p-5 text-center shadow-2xl"
                >
                  <div className="w-14 h-14 mx-auto bg-white rounded-2xl flex items-center justify-center mb-3 shadow-lg">
                    <Zap size={26} className="text-brand-600" />
                  </div>
                  <p className="text-white font-heading font-bold text-base">QuickSub</p>
                  <p className="text-blue-200 text-[11px] mt-0.5">Fast. Safe. Reliable.</p>
                </motion.div>
              </div>
            </div>

            {/* Order Progress Widget */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.9 }}
              className="mt-4 bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-5"
            >
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-3">Live Order Status</p>
              <div className="flex items-center gap-2">
                {progressSteps.map((step, i) => (
                  <div key={step} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className={`w-full h-1.5 rounded-full transition-all duration-700 ${
                        i <= currentStep ? 'bg-yellow-300' : 'bg-white/15'
                      }`}
                    />
                    <span
                      className={`text-[9px] font-medium leading-tight text-center transition-colors duration-500 ${
                        i <= currentStep ? 'text-yellow-300' : 'text-white/40'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <CheckCircle2 size={12} className="text-green-300" />
                <span className="text-green-200">Processing on track</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Wave bottom */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 35C360 70 1080 0 1440 35V70H0V35Z" fill="#F0F7FF" />
        </svg>
      </div>
    </section>
  );
}
