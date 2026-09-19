import { useProducts } from '../../data/catalog';
import { checkoutUrl } from '../../utils/navigation';
import SiteLink from '../ui/SiteLink';
import { api } from '../../utils/api';
import { useState } from 'react';
import { Facebook, Instagram, MessageCircle, Send, Mail, CheckCircle } from 'lucide-react';
import { openLegalDoc } from '../ui/LegalModal';

const LOGO_SRC = '/Logo.png';

const productLinks = [
  'Netflix Premium', 'Spotify Premium', 'PUBG UC',
  'Freefire Diamonds', 'ChatGPT Subscription', 'Disney+ Hotstar',
  'YouTube Premium', 'Canva Pro', 'Apple Music',
];
const supportLinks: { label: string; href?: string; action?: () => void }[] = [
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
  { label: 'Order Status', href: '/track' },
  { label: 'My account', href: '/account' },
  { label: 'Refund Policy', action: () => openLegalDoc('Refund Policy') },
  { label: 'Delivery Policy', action: () => openLegalDoc('Delivery Policy') },
];
const legalLinks = ['Terms and Conditions', 'Privacy Policy', 'Disclaimer', 'Cookie Policy'];

export default function Footer() {
  const products=useProducts();
  const [email, setEmail] = useState('');
  const [subState, setSubState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setSubState('loading');
    try {
      const data = await api<{ok:boolean}>('/requests', {kind:'newsletter', contact:email.trim(), message:''});
      if (data.ok) {
        setSubState('success');
        setEmail('');
      } else {
        setSubState('error');
      }
    } catch {
      setSubState('error');
    }
  };

  return (
    <footer className="bg-brand-950 text-white">
      <div className="max-w-7xl mx-auto px-4 pt-16 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <a href="#home" className="flex items-center gap-2.5 mb-5">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-md p-1.5">
                <img
                  src={LOGO_SRC}
                  alt="QuickSub"
                  className="w-full h-full object-contain"
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div>
                <p className="font-heading font-extrabold text-lg text-white leading-none">QuickSub</p>
                <p className="text-[10px] text-brand-300 mt-0.5">Fast. Safe. Reliable.</p>
              </div>
            </a>
            <p className="text-sm text-brand-200 leading-relaxed mb-6">
              QuickSub is a digital product store for subscriptions, gaming top-ups, and AI access — built for simple ordering and responsive support.
            </p>
            <div className="flex gap-2.5">
              {[Facebook, Instagram, MessageCircle, Send].map((Icon, i) => (
                <button
                  key={i}
                  className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 hover:bg-brand-600 hover:border-brand-600 text-brand-300 hover:text-white transition-all duration-200 flex items-center justify-center"
                  aria-label="Social link"
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-heading font-bold text-sm text-white mb-5">Products</h4>
            <ul className="space-y-2.5">
              {productLinks.map(link => (
                <li key={link}>
                  <SiteLink href={checkoutUrl(products.find(p=>p.name===link)?.id)} className="text-sm text-brand-300 hover:text-white transition-colors">
                    {link}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-heading font-bold text-sm text-white mb-5">Support</h4>
            <ul className="space-y-2.5">
              {supportLinks.map(link => (
                <li key={link.label}>
                  {link.action ? (
                    <button
                      onClick={link.action}
                      className="text-sm text-brand-300 hover:text-white transition-colors"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <SiteLink href={link.href} className="text-sm text-brand-300 hover:text-white transition-colors">
                      {link.label}
                    </SiteLink>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-heading font-bold text-sm text-white mb-5">Legal</h4>
            <ul className="space-y-2.5">
              {legalLinks.map(link => (
                <li key={link}>
                  <button
                    onClick={() => openLegalDoc(link)}
                    className="text-sm text-brand-300 hover:text-white transition-colors"
                  >
                    {link}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-heading font-bold text-sm text-white mb-5">Get Offer Updates</h4>
            <p className="text-sm text-brand-300 mb-4">Subscribe for deals and new product alerts.</p>
            <form onSubmit={handleSubscribe} className="space-y-2.5">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={subState === 'loading'}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/8 border border-white/10 rounded-xl text-sm text-white placeholder-brand-400 focus:outline-none focus:border-brand-400 focus:bg-white/12 transition-all disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={subState === 'loading' || subState === 'success'}
                className="w-full py-2.5 gradient-primary text-white text-sm font-semibold rounded-xl hover:shadow-blue-md transition-all flex items-center justify-center gap-2 disabled:opacity-80"
              >
                {subState === 'loading' && 'Subscribing...'}
                {subState === 'success' && <><CheckCircle size={14} /> Subscribed!</>}
                {subState === 'idle' && 'Subscribe'}
                {subState === 'error' && 'Try Again'}
              </button>
              {subState === 'success' && (
                <p className="text-xs text-green-300 mt-1">You'll receive our best deals.</p>
              )}
              {subState === 'error' && (
                <p className="text-xs text-red-300 mt-1">Something went wrong. Please try again.</p>
              )}
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row justify-between items-start gap-4">
          <p className="text-xs text-brand-400 max-w-xl leading-relaxed">
            QuickSub is an independent digital product and service provider. Product names, logos, and trademarks belong to their respective owners. QuickSub is not affiliated with or endorsed by those brands unless stated officially.
          </p>
          <p className="text-xs text-brand-400 whitespace-nowrap flex-shrink-0">
            &copy; {new Date().getFullYear()} QuickSub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
