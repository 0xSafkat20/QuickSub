import SiteLink from '../ui/SiteLink';
import { useState, useEffect } from 'react';
import { Menu, X, Search, ShoppingCart, Heart } from 'lucide-react';
import OrderTracking from '../sections/OrderTracking';
import { useWishlist } from '../../context/WishlistContext';

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

interface HeaderProps {
  onSearchOpen: () => void;
  onWishlistOpen: () => void;
}

export default function Header({ onSearchOpen, onWishlistOpen }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const { favorites } = useWishlist();

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onSearchOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSearchOpen]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
        document.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1280px)');
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    desktop.addEventListener('change', closeOnDesktop);
    return () => { window.removeEventListener('keydown', closeOnEscape); desktop.removeEventListener('change', closeOnDesktop); };
  }, [mobileOpen]);

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
          <span className="text-white/30">|</span>
          <span>Secure Payment</span>
          <span className="text-white/30">|</span>
          <span>Friendly Support Available</span>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#home" className="flex shrink-0 items-center gap-2.5 group">
          <img
            src={LOGO_SRC}
            alt="QuickSub – Fast. Safe. Reliable."
            className="hidden min-[380px]:block h-10 w-auto object-contain"
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

        <SiteLink href="/account" className={`hidden xl:inline-flex shrink-0 text-sm font-semibold px-2 py-2 ${scrolled ? "text-brand-700" : "text-white"}`}>My account</SiteLink>
        {/* Desktop Nav Links */}
        <div className="hidden xl:flex items-center gap-0.5">
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
        <div className="hidden xl:flex items-center gap-2">
          <SiteLink href="/cart" aria-label="My cart" className={`p-2 rounded-lg ${scrolled ? 'text-brand-600' : 'text-white'}`}><ShoppingCart size={18}/></SiteLink>
          <button
            onClick={onSearchOpen}
            className={`p-2 rounded-lg transition-colors ${
              scrolled ? 'text-ink-400 hover:text-brand-600 hover:bg-brand-50' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Search products"
            title="Search (Ctrl+K)"
          >
            <Search size={18} />
          </button>
          <button
            onClick={onWishlistOpen}
            className={`p-2 rounded-lg transition-colors relative ${
              scrolled ? 'text-ink-400 hover:text-brand-600 hover:bg-brand-50' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Saved products"
          >
            <Heart size={18} />
            {favorites.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>
          <OrderTracking />
          <a
            href="#products"
            className="ml-2 px-5 py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:shadow-blue-md transition-all duration-200 animate-pulse-blue"
          >
            Order Now
          </a>
        </div>

        {/* Mobile Actions */}
        <div className="flex xl:hidden items-center gap-1">
          <SiteLink href="/cart" aria-label="My cart" className={`p-2 ${scrolled ? 'text-brand-600' : 'text-white'}`}><ShoppingCart size={18}/></SiteLink>
          <button
            onClick={onSearchOpen}
            className={`p-2 ${scrolled ? 'text-ink-400' : 'text-white/70'}`}
            aria-label="Search"
          >
            <Search size={18} />
          </button>
          <button
            onClick={onWishlistOpen}
            className={`p-2 relative ${scrolled ? 'text-ink-400' : 'text-white/70'}`}
            aria-label="Saved products"
          >
            <Heart size={18} />
            {favorites.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-brand-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`p-2 ${scrolled ? 'text-ink-700' : 'text-white'}`}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div id="mobile-navigation" className="xl:hidden bg-white border-t border-brand-100 shadow-lg max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
            <SiteLink href="/account" onClick={() => setMobileOpen(false)} className="px-4 py-3 text-sm font-semibold text-brand-600 rounded-xl bg-brand-50">My account</SiteLink>
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
            <div className="flex gap-2 mt-3">
              <div className="flex-1">
                <OrderTracking />
              </div>
              <a
                href="#products"
                onClick={() => setMobileOpen(false)}
                className="flex-1 px-4 py-3 gradient-primary text-white text-sm font-semibold rounded-xl text-center"
              >
                Order Now
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
