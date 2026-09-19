import OrderTracking from './OrderTracking';
export default function PaymentReturn() {
  return <main className="min-h-screen bg-brand-50 grid place-items-center p-6"><div className="max-w-lg rounded-3xl bg-white p-8 space-y-4 shadow-lg">
    <h1 className="text-2xl font-bold text-brand-700">Check your payment</h1>
    <p>Use your order receipt to see the verified result and delivery status.</p>
    <OrderTracking />
    <a href="/" className="block text-brand-600 underline">Return to QuickSub</a>
  </div></main>;
}
