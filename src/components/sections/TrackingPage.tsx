import PageNavigation from '../layout/PageNavigation';
import OrderTracking from './OrderTracking';
import SiteLink from '../ui/SiteLink';
export default function TrackingPage() {
 return <div className="min-h-screen bg-page text-ink-800"><PageNavigation current="tracking"/><main className="max-w-2xl mx-auto p-4 py-10 space-y-5"><h1 className="text-3xl font-bold">Track your order</h1><p>Check payment confirmation and delivery using your order ID and private receipt code.</p><section className="bg-white rounded-2xl border border-brand-100 p-5 sm:p-7"><OrderTracking inline/></section><p className="text-sm">Purchased while signed in? <SiteLink href="/account" className="text-brand-600 underline">View your order history</SiteLink></p><SiteLink href="/#products" className="inline-block text-brand-600 font-semibold">Continue shopping →</SiteLink></main></div>;
}
