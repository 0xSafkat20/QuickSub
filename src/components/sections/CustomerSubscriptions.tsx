import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, CreditCard, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { navigate } from '../../utils/navigation';
import SiteLink from '../ui/SiteLink';

export type Subscription = {
  id:string;order_id:string;package_id:string;product_id:string;renewed_from:string|null;
  product_name:string;package_name:string;amount_bdt:number;status:'upcoming'|'active'|'expired'|'suspended'|'cancelled';
  starts_at:string;ends_at:string;payment_confirmed_at:string;device_limit:number;
  account_reference:string;delivery_instructions:string;created_at:string;updated_at:string;
};
type Reminder={id:string;subscription_id:string;kind:string;due_at:string;message:string};
export type SubscriptionResponse={subscriptions:Subscription[];reminders:Reminder[]};
const badge:Record<Subscription['status'],string>={active:'bg-green-100 text-green-800',upcoming:'bg-blue-100 text-blue-800',expired:'bg-amber-100 text-amber-900',suspended:'bg-red-100 text-red-800',cancelled:'bg-slate-100 text-slate-700'};
const shortDate=(value:string)=>new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});

export default function CustomerSubscriptions(){
 const [data,setData]=useState<SubscriptionResponse>({subscriptions:[],reminders:[]});
 const [tab,setTab]=useState<'all'|Subscription['status']>('all');
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{setData(await api<SubscriptionResponse>('/account/subscriptions'));}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const rows=useMemo(()=>tab==='all'?data.subscriptions:data.subscriptions.filter(s=>s.status===tab),[data.subscriptions,tab]);
 async function renew(id:string){setBusy(id);setError('');try{const result=await api<{checkout:string}>('/account/subscriptions/'+id+'/renew',{});navigate(result.checkout);}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function dismiss(id:string){setBusy(id);try{await api('/account/subscriptions/reminders/'+id+'/read',{});setData(current=>({...current,reminders:current.reminders.filter(r=>r.id!==id)}));}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 return <section className="rounded-2xl border border-brand-100 bg-white p-5 sm:p-6 space-y-5" aria-label="My subscriptions">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-xl">My subscriptions</h2><p className="text-sm text-ink-500 mt-1">Access periods begin when payment is confirmed.</p></div><button type="button" onClick={()=>void load()} disabled={loading||!!busy} className="inline-flex items-center gap-2 text-brand-600 font-semibold disabled:opacity-50"><RefreshCw size={16} className={loading?'animate-spin':''}/>Refresh</button></div>
  {data.reminders.length>0&&<div className="space-y-2" aria-label="Renewal reminders">{data.reminders.map(r=><div key={r.id} className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p className="flex gap-2"><Bell size={17} className="shrink-0 mt-0.5"/>{r.message}</p><button type="button" disabled={busy===r.id} onClick={()=>void dismiss(r.id)} className="underline">Dismiss</button></div>)}</div>}
  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Subscription status">{(['all','active','upcoming','expired','suspended','cancelled'] as const).map(value=><button type="button" role="tab" aria-selected={tab===value} key={value} onClick={()=>setTab(value)} className={'rounded-full px-3 py-1.5 text-xs font-semibold capitalize '+(tab===value?'bg-brand-600 text-white':'bg-brand-50 text-brand-700')}>{value}</button>)}</div>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
  {loading?<p role="status">Loading subscriptions…</p>:!rows.length?<p className="text-sm text-ink-500">{data.subscriptions.length?'No subscriptions in this group.':'Paid subscription purchases will appear here automatically.'}</p>:<div className="grid md:grid-cols-2 gap-4">{rows.map(s=>{const days=Math.max(0,Math.ceil((Date.parse(s.ends_at)-Date.now())/86400000));return <article key={s.id} className="rounded-xl border border-brand-100 p-4 space-y-3">
   <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{s.product_name}</h3><p className="text-sm text-ink-500">{s.package_name}</p></div><span className={'rounded-full px-2.5 py-1 text-xs font-bold capitalize '+badge[s.status]}>{s.status}</span></div>
   <p className="flex gap-2 text-sm"><CalendarDays size={17} className="text-brand-600"/>{shortDate(s.starts_at)} – {shortDate(s.ends_at)}</p>
   <p className="flex gap-2 text-sm"><MonitorSmartphone size={17} className="text-brand-600"/>Up to {s.device_limit} device{s.device_limit===1?'':'s'}</p>
   {s.status==='active'&&<p className="text-sm font-semibold text-green-700">{days} day{days===1?'':'s'} remaining</p>}
   <div className="flex flex-wrap items-center gap-4 pt-1"><SiteLink href={'/subscriptions/'+s.id} className="text-brand-600 font-semibold text-sm">View details</SiteLink>{['active','expired'].includes(s.status)&&<button type="button" disabled={!!busy} onClick={()=>void renew(s.id)} className="inline-flex items-center gap-1 text-brand-600 font-semibold text-sm disabled:opacity-50"><CreditCard size={15}/>{busy===s.id?'Opening…':'Renew'}</button>}</div>
  </article>;})}</div>}
 </section>;
}
