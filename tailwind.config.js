/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        sky: {
          ice: '#F0F7FF',
          soft: '#E8F1FC',
        },
        ink: {
          900: '#0F172A',
          700: '#1E293B',
          500: '#334155',
          400: '#475569',
          300: '#64748B',
          200: '#94A3B8',
          100: '#CBD5E1',
        },
        accent: {
          green:  '#16A34A',
          amber:  '#D97706',
          red:    '#DC2626',
          purple: '#7C3AED',
          teal:   '#0D9488',
        },
      },
      fontFamily: {
        heading: ['Sora', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'blue-sm':  '0 2px 12px rgba(37, 99, 235, 0.12)',
        'blue-md':  '0 8px 32px rgba(37, 99, 235, 0.18)',
        'blue-lg':  '0 20px 60px rgba(37, 99, 235, 0.22)',
        'blue-xl':  '0 30px 80px rgba(37, 99, 235, 0.28)',
        'card':     '0 4px 24px rgba(30, 58, 138, 0.08)',
        'card-hover': '0 12px 40px rgba(30, 58, 138, 0.16)',
      },
      animation: {
        'float':          'float 6s ease-in-out infinite',
        'float-delayed':  'float 6s ease-in-out 2s infinite',
        'float-slow':     'float 8s ease-in-out 1s infinite',
        'shimmer':        'shimmer 2.5s ease-in-out infinite',
        'pulse-blue':     'pulseBlue 3s ease-in-out infinite',
        'slide-up':       'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'gradient-shift': 'gradientShift 8s ease-in-out infinite',
        'orbit':          'orbit 12s linear infinite',
        'orbit-reverse':  'orbit 18s linear infinite reverse',
        'bounce-slow':    'bounceSlow 2.5s ease-in-out infinite',
        'ping-slow':      'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'wave':           'wave 2.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-14px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        pulseBlue: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.4)' },
          '50%':      { boxShadow: '0 0 0 16px rgba(37,99,235,0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        orbit: {
          '0%':   { transform: 'rotate(0deg) translateX(80px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(80px) rotate(-360deg)' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'translateY(-4px)', animationTimingFunction: 'cubic-bezier(0.8,0,1,1)' },
          '50%':      { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)' },
        },
        wave: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%':      { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [],
};
