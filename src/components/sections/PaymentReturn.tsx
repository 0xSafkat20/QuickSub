import PageNavigation from '../layout/PageNavigation';
import SiteLink from '../ui/SiteLink';
import OrderTracking from './OrderTracking';
export default function PaymentReturn() {
  return <><PageNavigation current="tracking"/><main className="min-h-[70dvh] bg-brand-50 grid place-items-center p-6"><div className="w-full min-w-0 max-w-lg rounded-3xl bg-white p-5 sm:p-8 space-y-4 shadow-lg">
    <h1 className="text-2xl font-bold text-brand-700">Check your payment</h1>
    <p>Use your order receipt to see the verified result and delivery status.</p>
    <OrderTracking inline />
    <SiteLink href="/" className="block text-brand-600 underline">Return to QuickSub</SiteLink>
  </div></main></>;
}
