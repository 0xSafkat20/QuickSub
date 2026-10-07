import SiteLink from '../ui/SiteLink';
import { LanguageSwitcher, useI18n } from '../../i18n';
export default function PageNavigation({current,accountHref='/account'}:{current:'checkout'|'account'|'tracking'|'cart';accountHref?:string}) {
 const {t}=useI18n();
 return <header className="bg-white border-b border-brand-100"><div className="max-w-5xl mx-auto p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"><SiteLink href="/" className="font-heading text-xl font-extrabold text-brand-700">QuickSub</SiteLink><div className="flex items-center gap-2"><LanguageSwitcher/><nav aria-label="Customer navigation" className="flex flex-wrap gap-1 text-sm font-semibold">{[{label:t('nav.browse'),href:'/#products',key:'store'},{label:t('nav.cart'),href:'/cart',key:'cart'},{label:t('nav.account'),href:accountHref,key:'account'},{label:t('nav.track'),href:'/track',key:'tracking'}].map(link=><SiteLink key={link.key} href={link.href} aria-current={current===link.key?'page':undefined} className={`px-3 py-3 rounded-xl ${current===link.key?'bg-brand-50 text-brand-800':'text-brand-600 hover:bg-brand-50'}`}>{link.label}</SiteLink>)}</nav></div></div></header>;
}
