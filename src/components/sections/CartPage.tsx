import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { api, ApiError } from '../../utils/api';
import { useSessionExpiry } from '../../utils/session';
import { accountUrl } from '../../utils/navigation';
import { cartCheckoutUrl, type CartItem, type CartResponse } from '../../utils/cart';
import PageNavigation from '../layout/PageNavigation';
import SiteLink from '../ui/SiteLink';

export default function CartPage() {
 const [items,setItems]=useState<CartItem[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 const [error,setError]=useState(''),[signedOut,setSignedOut]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try { const result=await api<CartResponse>('/cart');setItems(result.items);setSignedOut(false); }
  catch(err){setError((err as Error).message);if(err instanceof ApiError && err.status===401){setSignedOut(true);setItems([]);}}
  finally{setLoading(false);}
 },[]);
 useSessionExpiry('customer',()=>{setItems([]);setSignedOut(true);setNotice('Your session ended. Sign in again to restore your saved cart.');});
 useEffect(()=>{document.title='My cart | QuickSub';void load();return()=>{document.title='QuickSub';};},[load]);
 async function remove(item:CartItem){
  setBusy(item.package_id);setError('');
  try {await api('/cart/items/'+item.package_id,undefined,'DELETE');setItems(current=>current.filter(x=>x.package_id!==item.package_id));setNotice(item.product_name+' removed from your cart.');}
  catch(err){setError((err as Error).message);}finally{setBusy('');}
 }
 const total=items.filter(item=>item.available).reduce((sum,item)=>sum+Math.round(Number(item.price_bdt)*100),0)/100;
 return <div className="min-h-screen bg-page text-ink-800"><PageNavigation current="cart"/>
  <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-brand-600">SAVED TO YOUR ACCOUNT</p><h1 className="text-3xl font-bold mt-2">My cart</h1><p className="text-ink-500 mt-2">Your packages and delivery details, ready on any device when you sign in.</p></div>
   {!signedOut&&<button onClick={()=>void load()} disabled={loading||!!busy} className="rounded-xl border border-brand-200 px-4 py-3 text-brand-700 font-semibold disabled:opacity-50">Refresh cart</button>}</div>
   {notice&&<p role="status" className="rounded-xl bg-brand-50 p-4">{notice}</p>}
   {error&&!signedOut&&<p role="alert" className="rounded-xl bg-red-50 text-red-700 p-4">{error}</p>}
   {loading?<p role="status">Loading your cart…</p>:signedOut?<section className="rounded-2xl border border-brand-100 bg-white p-7 space-y-4"><h2 className="text-xl font-bold">Sign in to open your cart</h2><p>Your saved packages stay in your account when you sign out.</p><SiteLink href={accountUrl('/cart')} className="inline-block rounded-xl bg-brand-600 px-5 py-3 text-white font-semibold">Sign in to my cart</SiteLink></section>:!items.length?<section className="rounded-2xl border border-brand-100 bg-white p-8 space-y-4"><ShoppingCart size={32} className="text-brand-600"/><h2 className="text-xl font-bold">Your cart is empty</h2><p>Choose a product and package, then select “Add to cart” on the checkout page.</p><SiteLink href="/#products" className="inline-flex items-center gap-2 text-brand-600 font-semibold">Browse products <ArrowRight size={16}/></SiteLink></section>:<div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
    <section aria-label="Cart items" className="space-y-4">{items.map(item=><article key={item.package_id} className="rounded-2xl border border-brand-100 bg-white p-5 space-y-3">
     <div className="flex justify-between items-start gap-4"><div className="min-w-0"><h2 className="text-lg font-bold break-words">{item.product_name}</h2><p className="text-ink-500 break-words">{item.package_name}</p></div><p className="font-bold whitespace-nowrap">৳{Number(item.price_bdt).toFixed(2)}</p></div>
     {!item.available&&<p role="status" className="rounded-lg bg-amber-50 text-amber-900 p-3">Currently unavailable. You can keep this item for later or remove it.</p>}
     {(item.name||item.contact)&&<p className="text-sm break-words">Delivery: {item.name}{item.name&&item.contact?' · ':''}{item.contact}</p>}
     {item.note&&<p className="text-sm text-ink-500 whitespace-pre-wrap break-words">{item.note}</p>}
     <div className="flex flex-wrap items-center justify-between gap-3 pt-2">{item.available?<SiteLink href={cartCheckoutUrl(item)} className="rounded-xl bg-brand-600 text-white px-4 py-3 text-sm font-semibold">Review &amp; checkout</SiteLink>:<SiteLink href="/#products" className="text-brand-600 font-semibold">Browse alternatives</SiteLink>}
     <button aria-label={'Remove '+item.product_name+' '+item.package_name} disabled={!!busy} onClick={()=>void remove(item)} className="inline-flex items-center gap-2 px-3 py-3 text-sm text-ink-500 hover:text-red-700 disabled:opacity-50"><Trash2 size={16}/>{busy===item.package_id?'Removing…':'Remove'}</button></div>
    </article>)}</section>
    <aside className="rounded-2xl border border-brand-100 bg-white p-5 space-y-4"><h2 className="font-bold text-lg">Cart summary</h2><p>{items.length} of 20 saved packages</p><div className="flex justify-between gap-3 font-semibold"><span>Available subtotal</span><span>৳{total.toFixed(2)}</span></div><p className="text-sm text-ink-500">Prices are checked again before payment. Each package has its own order and payment.</p><p className="text-sm text-ink-500">An item leaves your cart only after its order is created. Pending orders stay in your account.</p><SiteLink href="/account" className="inline-block text-brand-600 font-semibold">View my orders →</SiteLink></aside>
   </div>}
  </main></div>;
}
