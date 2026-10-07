import { useEffect } from 'react';
import { useI18n } from '../../i18n';

const SITE = 'https://quicksub.com';
const defaultDescription = 'Buy digital subscriptions, AI tools, streaming plans and game top-ups in Bangladesh with BDT pricing, secure payment, fast delivery and verified customer reviews.';
const keywords = 'digital subscriptions Bangladesh, game top up Bangladesh, streaming subscription Bangladesh, AI tools subscription Bangladesh, Netflix Premium Bangladesh, Spotify Premium Bangladesh, PUBG UC, Free Fire Diamonds, ChatGPT subscription Bangladesh, buy digital products BDT, QuickSub';

const routeMeta: Record<string, {title: string; description: string; index?: boolean}> = {
  '/': { title: 'Digital Subscriptions & Game Top-Ups in Bangladesh | QuickSub', description: defaultDescription, index: true },
  '/checkout': { title: 'Secure Digital Product Checkout | QuickSub', description: 'Choose a QuickSub package and securely order a digital subscription, AI tool or gaming top-up in Bangladesh.' },
  '/buy': { title: 'Buy Digital Subscriptions & Game Top-Ups | QuickSub', description: 'Order digital subscriptions and gaming top-ups with transparent BDT pricing and tracked delivery.' },
  '/cart': { title: 'Your Shopping Cart | QuickSub', description: 'Review your selected digital subscriptions and gaming top-up packages before checkout.' },
  '/track': { title: 'Track Your Digital Order | QuickSub', description: 'Privately track payment verification and delivery status for your QuickSub order.' },
  '/account': { title: 'My Account & Purchases | QuickSub', description: 'Manage QuickSub purchases, subscriptions, receipts and verified product reviews.' },
};

function setMeta(selector: string, attribute: string, value: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector);
  if (element) element.setAttribute(attribute, value);
}

export default function Seo({ path }: { path: string }) {
  const {locale,t}=useI18n();
  useEffect(() => {
    const meta = routeMeta[path] || { title: 'QuickSub | Secure Digital Services', description: defaultDescription, index: false };
    const localizedTitle=path==='/'?t('seo.home.title'):path==='/checkout'||path==='/buy'?t('seo.checkout.title'):path==='/account'?t('seo.account.title'):path==='/track'?t('seo.track.title'):path==='/cart'?t('seo.cart.title'):meta.title;
    const localizedDescription=path==='/'?t('seo.home.description'):meta.description;
    const canonicalPath = meta.index ? '/' : path;
    const localizedUrl=SITE+canonicalPath+(locale==='bn-BD'?'?lang=bn':'');
    document.title = localizedTitle;
    setMeta('meta[name="description"]', 'content', localizedDescription);
    setMeta('meta[name="keywords"]', 'content', keywords);
    setMeta('meta[name="robots"]', 'content', meta.index ? 'index, follow, max-image-preview:large' : 'noindex, follow');
    setMeta('meta[property="og:title"]', 'content', localizedTitle);
    setMeta('meta[property="og:description"]', 'content', localizedDescription);
    setMeta('meta[property="og:url"]', 'content', localizedUrl);
    setMeta('meta[name="twitter:title"]', 'content', localizedTitle);
    setMeta('meta[name="twitter:description"]', 'content', localizedDescription);
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', localizedUrl);
    for(const code of ['en-BD','bn-BD','x-default']){
      let link=document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${code}"]`);
      if(!link){link=document.createElement('link');link.rel='alternate';link.hreflang=code;document.head.appendChild(link);}
      link.href=SITE+canonicalPath+(code==='bn-BD'?'?lang=bn':'');
    }
    const existing = document.getElementById('quicksub-page-schema');
    existing?.remove();
    const schema = document.createElement('script');
    schema.id = 'quicksub-page-schema'; schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': meta.index ? 'OnlineStore' : 'WebPage', name: localizedTitle, description: localizedDescription, url: localizedUrl, inLanguage: locale, isPartOf: { '@type': 'WebSite', name: 'QuickSub', url: SITE } });
    document.head.appendChild(schema);
    return () => schema.remove();
  }, [path,locale,t]);
  return null;
}
