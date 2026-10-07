import { useEffect, useState } from 'react';
import { Copy, Gift, MessageCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { REFERRAL_KEY, useI18n } from '../../i18n';

export type RewardSettings = {enabled:boolean;points_per_10_bdt:number;bdt_per_point:number;minimum_redemption:number;maximum_discount_percent:number;referral_reward:number;referred_reward:number;referral_wait_days:number;monthly_referral_limit:number};
export type RewardSummary = {balance:number;lifetimeEarned:number;lifetimeRedeemed:number;referralCode:string;locale:string;programReady?:boolean;referrals:{total:number;pending:number;rewarded:number};settings:RewardSettings;transactions:{id:string;order_id?:string;kind:string;points:number;description:string;created_at:string}[]};
const panel='rounded-2xl border border-brand-100 bg-white p-5 sm:p-7 space-y-5';
export default function RewardsPanel(){
 const {t,money,number}=useI18n();
 const [data,setData]=useState<RewardSummary|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 async function load(){setError('');try{const pending=localStorage.getItem(REFERRAL_KEY);if(pending){try{await api('/account/referral',{code:pending});localStorage.removeItem(REFERRAL_KEY);}catch{/* Keep it so the customer can correct or retry later. */}}setData(await api<RewardSummary>('/account/rewards'));}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();},[]);
 if(error)return <section className={panel}><h2 className="font-bold text-xl">{t('rewards.title')}</h2><p role="alert" className="text-red-700">{error}</p><button className="text-brand-600 underline" onClick={()=>void load()}>{t('common.retry')}</button></section>;
 if(!data)return <section className={panel} aria-busy="true"><p>{t('common.loading')}</p></section>;
 const link=`${window.location.origin}/?ref=${encodeURIComponent(data.referralCode)}`;
 const share=`https://wa.me/?text=${encodeURIComponent(`Join QuickSub with my referral code ${data.referralCode}: ${link}`)}`;
 return <section className={panel} aria-labelledby="rewards-title"><div className="flex items-center gap-3"><span className="rounded-xl bg-brand-50 p-3 text-brand-600"><Gift/></span><div><h2 id="rewards-title" className="font-bold text-xl">{t('rewards.title')}</h2><p className="text-xs text-ink-500">{t('rewards.explain')}</p></div></div>
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{[[t('rewards.balance'),number(data.balance)],[t('rewards.value'),money(data.balance/4)],[t('rewards.redeemed'),number(data.lifetimeRedeemed)]].map(([label,value])=><div key={label} className="rounded-xl bg-brand-50 p-3"><span className="block text-xs text-ink-500">{label}</span><strong className="text-lg">{value}</strong></div>)}</div>
  {data.programReady===false&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{t('rewards.startRule')}</p>}
  {data.referralCode&&<div className="rounded-xl border border-brand-100 p-4 space-y-3"><h3 className="font-bold">{t('rewards.referral')}</h3><p className="text-sm text-ink-500">{t('rewards.code')}: <strong className="text-ink-900">{data.referralCode}</strong></p><div className="flex flex-wrap gap-2"><button className="rounded-lg border border-brand-200 px-3 py-2 text-sm font-semibold" onClick={async()=>{await navigator.clipboard.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),1800);}}><Copy size={15} className="inline mr-2"/>{copied?t('common.copied'):t('common.copy')}</button><a href={share} target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"><MessageCircle size={15} className="inline mr-2"/>{t('rewards.whatsapp')}</a></div><div className="grid grid-cols-2 gap-3 text-sm"><p>{t('rewards.pending')}: <strong>{number(data.referrals.pending)}</strong></p><p>{t('rewards.success')}: <strong>{number(data.referrals.rewarded)}</strong></p></div></div>}
 </section>;
}
