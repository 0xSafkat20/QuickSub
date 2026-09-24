import { useSessionExpiry } from '../../utils/session';
import PageNavigation from '../layout/PageNavigation';
import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import SiteLink from '../ui/SiteLink';
import { checkoutUrl, checkoutReturn, navigate } from '../../utils/navigation';
type Profile = { name: string; contact: string; renewal_reminders: boolean };
type Session = { user: { id: string; email: string } | null; profile: Profile | null };
type Order = { id: string; product_id: string; product_name: string; package_name: string; amount_bdt: number; status: string; payment_status: string; delivery_note: string; created_at: string; expires_at: string | null };
const field='w-full border border-brand-200 rounded-xl p-3 mt-2 bg-white outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition-shadow';
const button='rounded-xl bg-brand-600 text-white px-5 py-3 font-semibold disabled:opacity-50';
const panel='rounded-2xl border border-brand-100 bg-white p-5 sm:p-7 space-y-4';
export default function AccountPage() {
 const returnTo = checkoutReturn();
 const [showPassword,setShowPassword]=useState(false);

 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [signup,setSignup]=useState(false),[orders,setOrders]=useState<Order[]>([]),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[ordersLoading,setOrdersLoading]=useState(false);
 useEffect(()=>setShowPassword(false),[signup]);
 const [profile,setProfile]=useState<Profile>({name:'',contact:'',renewal_reminders:true});
 useSessionExpiry('customer', () => {
  setSession({user:null,profile:null});setOrders([]);setHasMore(false);setOffset(0);
  setProfile({name:'',contact:'',renewal_reminders:true});
  setMessage('');setError('');setSignup(false);
 });
 async function loadSession() {const result=await api<Session>('/account/session');setSession(result);if(result.profile)setProfile(result.profile);return result;}
 async function loadOrders(page:number) {setOrdersLoading(true);try {const result=await api<{orders:Order[];hasMore:boolean}>('/account/orders?offset='+page);setOrders(result.orders);setHasMore(result.hasMore);setOffset(page);}finally{setOrdersLoading(false);}}
 useEffect(()=>{
  document.title='My account | QuickSub';
  // Email confirmation may return a Supabase token fragment. Password sign-in establishes our HTTP-only session.
  if(window.location.hash.includes('access_token=')||window.location.hash.includes('error='))window.history.replaceState(null,'','/account');
  void loadSession().catch(e=>setError(e.message)).finally(()=>setLoading(false));
  return ()=>{document.title='QuickSub';};
 },[]);
 const userId=session?.user?.id;
 useEffect(()=>{if(userId)void loadOrders(0).catch(e=>setError(e.message));},[userId]);
 async function action(work:()=>Promise<void>) {setBusy(true);setError('');setMessage('');try{await work();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="min-h-screen bg-page text-ink-800"><PageNavigation current="account"/>
 <main className={'mx-auto px-4 py-10 sm:py-14 space-y-6 '+(session?.user?'max-w-5xl':'max-w-lg')}><div className={session?.user?'':'text-center'}><h1 className="text-3xl font-bold mt-2">My account</h1><p className="text-ink-500 mt-3 text-sm leading-relaxed">Your saved cart, orders, and account details in one place.</p></div>
 {returnTo&&<SiteLink href={returnTo} className="inline-block rounded-xl bg-brand-600 text-white px-4 py-3 font-semibold">Back to {returnTo.startsWith('/cart')?'your cart':'your checkout'} →</SiteLink>}
 {error&&<div role="alert" className="rounded-xl bg-red-50 text-red-700 p-4"><p>{error}</p>{session===null&&<button type="button" disabled={busy} className="mt-3 underline font-semibold disabled:opacity-50" onClick={()=>void action(async()=>{await loadSession();})}>{busy?"Retrying…":"Retry connection"}</button>}</div>}{message&&<p role="status" className="rounded-xl bg-green-50 text-green-800 p-4">{message}</p>}
 {loading?<p role="status" className="text-center">Loading your account…</p>:!session?.user?<section className={panel+' w-full shadow-xl shadow-brand-100/40'}>
 <h2 className="text-xl font-bold">{signup?'Create your account':'Welcome back'}</h2>
 {signup&&<p className="text-sm text-ink-500">Save your details for easier checkout and keep track of every order.</p>}
 <form key={String(signup)} className="space-y-4" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void action(async()=>{
 const result=await api<{message?:string}>(signup?'/account/signup':'/account/login',{...(signup?{name:data.get('name')}:{}),email:data.get('email'),password:data.get('password')});const active=await loadSession();if(active.user && returnTo){navigate(returnTo);return;}setMessage(result.message||'Signed in.');
 });}}>
 {signup&&<label className="block">Your name<input name="name" className={field} placeholder="Enter your name" autoComplete="name" required maxLength={120}/></label>}
 <label className="block">Email<input name="email" type="email" className={field} placeholder="yourname@gmail.com" autoComplete="email" required maxLength={254}/></label>
 <div><label htmlFor="account-password" className="block">Password</label><div className="relative mt-2"><input id="account-password" name="password" type={showPassword?'text':'password'} className={field.replace('mt-2', 'pr-20')} aria-describedby="password-guidance" autoComplete={signup?'new-password':'current-password'} required minLength={signup?10:1} maxLength={128}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-controls="account-password" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)} className="absolute right-1 top-1 bottom-1 w-16 rounded-lg text-sm font-semibold text-brand-600 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600">{showPassword?'Hide':'Show'}</button></div></div>
 <p id="password-guidance" className="rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-ink-500"><strong className="text-ink-800">Keep your account secure.</strong> {signup?'Choose':'When creating an account, choose'} a unique password with at least 10 characters. A longer passphrase with a mix of letters, numbers, and symbols is a good choice.</p>
 <button disabled={busy} className={button+' w-full hover:bg-brand-700 transition-colors'}>{busy?'Please wait…':signup?'Create account':'Sign in'}</button>
 </form>{!signup&&<SiteLink href={'/forgot-password'+(returnTo?'?next='+encodeURIComponent(returnTo):'')} className="block text-brand-600 underline">Forgot password?</SiteLink>}<button type="button" disabled={busy} className="text-brand-600 underline" onClick={()=>{setSignup(!signup);setError('');setMessage('');}}>{signup?'Already registered? Sign in':'New here? Create an account'}</button>
 {signup&&<p className="border-t border-brand-100 pt-4 text-xs leading-relaxed text-ink-500">Already confirmed your email? You can sign in with your password.</p>}
 </section>:<>
 <div className="flex flex-wrap items-center justify-between gap-3"><p className="break-all">Signed in as <strong>{session.user.email}</strong></p><button disabled={busy} className="text-brand-600 underline" onClick={()=>void action(async()=>{await api('/account/logout',{});setSession({user:null,profile:null});setOrders([]);setProfile({name:'',contact:'',renewal_reminders:true});setMessage('Signed out.');})}>Sign out</button></div>
 <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-6 items-start"><div className="space-y-6"><section className={panel}><h2 className="font-bold text-xl">Saved details</h2><form className="space-y-4" onSubmit={e=>{e.preventDefault();void action(async()=>{await api('/account/profile',profile);setMessage('Your profile has been saved.');});}}>
 <label className="block">Your name<input className={field} value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})} placeholder="Enter your name" autoComplete="name" required maxLength={120}/></label>
 <label className="block">Contact email or phone<input className={field} value={profile.contact} onChange={e=>setProfile({...profile,contact:e.target.value})} placeholder="yourname@gmail.com" required minLength={5} maxLength={160}/></label>
 <label className="flex gap-2 items-start"><input type="checkbox" checked={profile.renewal_reminders} onChange={e=>setProfile({...profile,renewal_reminders:e.target.checked})}/>Show renewal reminders in my account</label><p className="text-xs text-ink-500">Reminders appear seven days before the expiry date confirmed by staff. No automatic renewal or charge.</p>
 <button className={button} disabled={busy}>Save profile</button></form></section>
 <section className={panel}><h2 className="font-bold text-lg">Add a guest order</h2><p className="text-sm text-ink-500">Use the private receipt you saved at checkout. Orders are never linked by email alone.</p><form className="space-y-3" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const data=new FormData(form);void action(async()=>{await api('/account/claim',{id:data.get('id'),accessCode:data.get('accessCode')});await loadOrders(0);form.reset();setMessage('Order added to your account.');});}}><label className="block">Order ID<input name="id" className={field} required maxLength={36}/></label><label className="block">Private access code<input name="accessCode" type="password" className={field} autoComplete="off" required minLength={64} maxLength={64}/></label><button disabled={busy} className={button}>Add order</button></form></section></div>
 <section className={panel} aria-label="Order history"><div className="flex justify-between items-center"><h2 className="font-bold text-xl">Order history</h2><button disabled={busy||ordersLoading} className="text-brand-600" onClick={()=>void action(()=>loadOrders(offset))}>Refresh</button></div>
 {ordersLoading?<p role="status">Loading orders…</p>:!orders.length?<p className="text-ink-500">No orders yet. Purchases made while signed in appear here. Demo payments do not create orders.</p>:orders.map(order=>{const days=order.expires_at?Math.ceil((Date.parse(order.expires_at)-Date.now())/86400000):null;const subscription=order.status==='delivered'&&order.payment_status==='verified';return <article key={order.id} className="border border-brand-100 rounded-xl p-4 space-y-2"><h3 className="font-bold">{order.product_name}</h3><p>{order.package_name} · ৳{order.amount_bdt}</p><p className="text-xs [overflow-wrap:anywhere] text-ink-500">{order.id} · {new Date(order.created_at).toLocaleDateString()}</p><p className="text-sm">Order: <strong>{order.status}</strong> · Payment: <strong>{order.payment_status}</strong></p>{order.delivery_note&&<p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{order.delivery_note}</p>}
 {subscription&&order.expires_at&&<p className="text-sm">Expires: {new Date(order.expires_at).toLocaleDateString()}</p>}
 {subscription&&profile.renewal_reminders&&days!==null&&days<=7&&<p className="bg-amber-50 text-amber-900 rounded-lg p-3 text-sm" role="status">{days<=0?'Your subscription has expired or expires today.':`Renewal reminder: your subscription expires in ${days} day${days===1?'':'s'}.`}</p>}
 {order.product_id&&<SiteLink href={checkoutUrl(order.product_id)} className="inline-block text-brand-600 font-semibold text-sm">{subscription&&order.expires_at?'Renew subscription':'Buy again'} →</SiteLink>}
 </article>;})}
 <div className="flex justify-between"><button disabled={busy||ordersLoading||offset===0} className="text-brand-600 disabled:opacity-40" onClick={()=>void action(()=>loadOrders(Math.max(0,offset-20)))}>Previous</button><button disabled={busy||ordersLoading||!hasMore} className="text-brand-600 disabled:opacity-40" onClick={()=>void action(()=>loadOrders(offset+20))}>Next</button></div>
 <p className="text-xs text-ink-500">Have a pending payment? <SiteLink href="/track" className="text-brand-600 underline">Open order tracking</SiteLink> with your private receipt.</p></section></div></>}
 </main></div>;
}
