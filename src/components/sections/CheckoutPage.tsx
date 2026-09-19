import PageNavigation from '../layout/PageNavigation';
import { accountUrl } from '../../utils/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Package, ShieldCheck } from 'lucide-react';
import { refreshProducts, useProducts } from '../../data/catalog';
import { refreshStore } from '../../data/store';
import { checkoutUrl } from '../../utils/navigation';
import CustomerOrder from './CustomerOrder';
import SiteLink from '../ui/SiteLink';
export default function CheckoutPage() {
  const products = useProducts();
  const [loading, setLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('product');
  const legacyText = (params.get('text') || '').toLowerCase();
  const product = productId ? products.find(p => p.id === productId) : [...products].sort((a,b) => b.name.length - a.name.length).find(p => legacyText.includes(p.name.toLowerCase()));
  useEffect(() => {
    let active = true;
    void Promise.all([refreshProducts(), refreshStore()]).finally(() => { if (active) setLoading(false); });
    document.title = 'Checkout | QuickSub';
    return () => { active = false; document.title = 'QuickSub'; };
  }, []);
  return <div className="min-h-screen bg-page text-ink-800">
    <PageNavigation current="checkout" accountHref={accountUrl(checkoutUrl(product?.id))}/>
    <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      <SiteLink href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 mb-7"><ArrowLeft size={16} /> Back to store</SiteLink>
      <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-3">Complete your order</h1>
      <p className="text-sm text-ink-500 mb-8">Choose a package, enter your delivery details, then continue to payment.</p>
      {loading ? <p role="status" className="rounded-2xl bg-white border border-brand-100 p-8">Loading checkout…</p> : product ? <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-6 items-start">
        <aside className="rounded-2xl bg-white border border-brand-100 overflow-hidden">
          {imageFailed ? <div className="h-40 bg-gradient-to-br from-brand-600 to-blue-900 text-white flex flex-col items-center justify-center gap-3"><Package size={36} aria-hidden="true" /><span className="font-heading font-bold text-lg">{product.name}</span></div> : <img src={product.bannerImage} alt="" onError={() => setImageFailed(true)} className="w-full h-40 object-cover" />}
          <div className="p-6 space-y-4">
            <p className="text-xs uppercase font-bold text-brand-600">Order summary</p>
            <h2 className="text-xl font-bold">{product.name}</h2>
            <p className="text-sm text-ink-500">{product.cardCopy}</p>
            <p className="text-sm flex gap-2"><Package size={17} className="shrink-0 text-brand-600" />{product.deliveryEstimate}</p>
            <p className="text-xs text-ink-500 flex gap-2"><ShieldCheck size={17} className="shrink-0 text-brand-600" />Your exact total is confirmed from the selected package before creating an order.</p>
          </div>
        </aside>
        <section className="rounded-2xl bg-white border border-brand-100 p-5 sm:p-7" aria-label="Checkout details">
          {product.outOfStock ? <p role="status">This product is currently out of stock. Please choose another product.</p> : <CustomerOrder key={product.id} productId={product.id} productName={product.name} />}
        </section>
      </div> : <section className="space-y-4" aria-label="Choose a product">
        {productId && <p role="status" className="rounded-xl bg-amber-50 p-4">This product is unavailable. Choose another product below.</p>}
        <h2 className="text-lg font-bold">Choose a product to check out</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{products.filter(p => !p.outOfStock).map(p => <SiteLink key={p.id} href={checkoutUrl(p.id)} className="rounded-2xl bg-white border border-brand-100 p-5 hover:border-brand-400 transition-colors">
          <h3 className="font-bold mb-2">{p.name}</h3><p className="text-sm text-brand-600">Select a package →</p>
        </SiteLink>)}</div>
      </section>}
    </main>
  </div>;
}
