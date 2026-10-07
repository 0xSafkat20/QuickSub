import PageNavigation from '../layout/PageNavigation';
import OrderTracking from './OrderTracking';
import SiteLink from '../ui/SiteLink';
import { useI18n } from '../../i18n';
export default function TrackingPage() {
 const {t}=useI18n();
 return <div className="min-h-screen bg-page text-ink-800"><PageNavigation current="tracking"/><main className="max-w-2xl mx-auto p-4 py-10 space-y-5"><h1 className="text-3xl font-bold">{t('tracking.title')}</h1><p>{t('tracking.subtitle')}</p><section className="bg-white rounded-2xl border border-brand-100 p-5 sm:p-7"><OrderTracking inline/></section><p className="text-sm">{t('tracking.signedIn')} <SiteLink href="/account" className="text-brand-600 underline">{t('tracking.history')}</SiteLink></p><SiteLink href="/#products" className="inline-block text-brand-600 font-semibold">{t('tracking.continue')} →</SiteLink></main></div>;
}
