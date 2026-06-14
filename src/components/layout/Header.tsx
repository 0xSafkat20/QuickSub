import { useState, useEffect } from 'react';
import { Menu, X, Search, ShoppingCart } from 'lucide-react';

const navLinks = [
  { label: 'Home',        href: '#home' },
  { label: 'Products',    href: '#products' },
  { label: 'Deals',       href: '#deals' },
  { label: 'How It Works',href: '#how-it-works' },
  { label: 'Reviews',     href: '#reviews' },
  { label: 'FAQ',         href: '#faq' },
  { label: 'Contact',     href: '#contact' },
];

const LOGO_SRC = '/Logo.png';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const sections = navLinks.map(l => l.href.slice(1));
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-brand-100'
          : 'bg-transparent'
      }`}
    >
      {/* Top Announcement Bar */}
      <div className="bg-brand-600 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 h-9 flex items-center justify-center gap-6 text-xs text-white/90 font-medium">
          <span>Fast Digital Delivery</span>
          <span className="text-white/30">•</span>
          <span>Secure Payment</span>
          <span className="text-white/30">•</span>
          <span>Friendly Support Available</span>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#home" className="flex items-center gap-2.5 group">
          <img
            src={LOGO_SRC}
            alt="QuickSub – Fast. Safe. Reliable."
            className="h-10 w-auto object-contain"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <span
            className={`font-heading font-extrabold text-xl tracking-tight transition-colors ${
              scrolled ? 'text-brand-900' : 'text-white'
            }`}
          >
            QuickSub
          </span>
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-0.5">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeSection === link.href.slice(1)
                  ? scrolled
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-white bg-white/15'
                  : scrolled
                    ? 'text-ink-500 hover:text-brand-700 hover:bg-brand-50'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            className={`p-2 rounded-lg transition-colors ${
              scrolled ? 'text-ink-400 hover:text-brand-600 hover:bg-brand-50' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Search"
          >
            <Search size={18} />
          </button>
          <button
            className={`p-2 rounded-lg transition-colors relative ${
              scrolled ? 'text-ink-400 hover:text-brand-600 hover:bg-brand-50' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Cart"
          >
            <ShoppingCart size={18} />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">0</span>
          </button>
          <a
            href="#products"
            className="ml-2 px-5 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:shadow-blue-md transition-all duration-200 animate-pulse-blue"
          >
            Order Now
          </a>
        </div>

        {/* Mobile Actions */}
        <div className="flex lg:hidden items-center gap-1">
          <button className={`p-2 ${scrolled ? 'text-ink-400' : 'text-white/70'}`} aria-label="Cart">
            <ShoppingCart size={18} />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`p-2 ${scrolled ? 'text-ink-700' : 'text-white'}`}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-brand-100 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  activeSection === link.href.slice(1)
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-ink-500 hover:text-brand-700 hover:bg-brand-50'
                }`}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#products"
              onClick={() => setMobileOpen(false)}
              className="mt-3 px-4 py-3 gradient-primary text-white text-sm font-semibold rounded-xl text-center"
            >
              Order Now
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
