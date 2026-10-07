import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CreditCard, MonitorSmartphone } from 'lucide-react';
import { api } from '../../utils/api';
import { navigate } from '../../utils/navigation';
import { downloadReceipt } from '../../utils/receiptPdf';
import type { TrackedOrder } from './CustomerOrder';
import type { Subscription } from './CustomerSubscriptions';
import PageNavigation from '../layout/PageNavigation';
import SiteLink from '../ui/SiteLink';
import { useI18n } from '../../i18n';
export default function SubscriptionPage(){
 const {t,date,number}=useI18n();
 const id=window.location.pathname.split('/')[2]||'';
 const [subscription,setSubscription]=useState<Subscription|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 useEffect(()=>{let active=true;document.title='Subscription | QuickSub';api<{subscription:Subscription}>('/account/subscriptions/'+id).then(r=>{if(active)setSubscription(r.subscription);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;document.title='QuickSub';};},[id]);
 async function renew(){if(!subscription)return;setBusy('renew');try{const r=await api<{checkout:string}>('/account/subscriptions/'+subscription.id+'/renew',{});navigate(r.checkout);}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function receipt(){if(!subscription)return;setBusy('receipt');try{const r=await api<{receipts:TrackedOrder[]}>('/account/subscriptions/'+subscription.id+'/receipts');if(!r.receipts[0])throw new Error('Receipt is unavailable.');await downloadReceipt(r.receipts[0]);}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 return <div className="min-h-screen bg-page text-ink-800"><PageNavigation current="account"/><main className="max-w-3xl mx-auto px-4 py-10 space-y-6"><SiteLink href="/account" className="inline-flex items-center gap-2 text-brand-600 font-semibold"><ArrowLeft size={16}/>{t('subscriptions.back')}</SiteLink>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
  {!subscription&&!error?<p role="status">{t('subscriptions.loading')}</p>:subscription&&<><header><p className="text-sm font-bold uppercase text-brand-600">{t('subscriptions.detailTitle')}</p><h1 className="text-3xl font-bold mt-2">{subscription.product_name}</h1><p className="text-ink-500 mt-2">{subscription.package_name}</p></header>
  <section className="rounded-2xl border border-brand-100 bg-white p-6 space-y-4"><div className="flex justify-between gap-4"><strong>{t('common.status')}</strong><span>{t('subscriptions.'+subscription.status)}</span></div><div className="flex gap-3"><CalendarDays className="text-brand-600 shrink-0"/><div><strong>{t('subscriptions.access')}</strong><p>{date(subscription.starts_at)} – {date(subscription.ends_at)}</p><p className="text-xs text-ink-500 mt-1">{t('subscriptions.confirmed',{date:date(subscription.payment_confirmed_at)})}</p></div></div><div className="flex gap-3"><MonitorSmartphone className="text-brand-600 shrink-0"/><div><strong>{t('subscriptions.devices')}</strong><p>{t('common.deviceCount',{count:number(subscription.device_limit)})}</p></div></div>{subscription.account_reference&&<div><strong>{t('subscriptions.assigned')}</strong><p className="break-words">{subscription.account_reference}</p></div>}{subscription.delivery_instructions&&<div><strong>{t('subscriptions.instructions')}</strong><p className="whitespace-pre-wrap break-words">{subscription.delivery_instructions}</p></div>}<p className="text-sm">{t('common.order')} {subscription.order_id}</p><div className="flex flex-wrap gap-3 pt-2"><button type="button" onClick={()=>void receipt()} disabled={!!busy} className="rounded-xl border border-brand-200 px-4 py-3 text-brand-700 font-semibold disabled:opacity-50">{busy==='receipt'?t('subscriptions.preparing'):t('subscriptions.receipt')}</button>{['active','expired'].includes(subscription.status)&&<button type="button" onClick={()=>void renew()} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-white font-semibold disabled:opacity-50"><CreditCard size={17}/>{busy==='renew'?t('subscriptions.opening'):t('subscriptions.renewFull')}</button>}</div></section></>}
 </main></div>;
}
