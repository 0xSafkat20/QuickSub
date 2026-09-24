import { useEffect, useState } from 'react';
import PageNavigation from '../layout/PageNavigation';
import SiteLink from '../ui/SiteLink';
import { api } from '../../utils/api';
import { accountUrl, checkoutReturn } from '../../utils/navigation';
const field='w-full rounded-xl border border-brand-200 p-3 mt-1';
const button='w-full rounded-xl bg-brand-600 text-white font-semibold p-3 disabled:opacity-50';
export default function PasswordRecovery({reset=false}:{reset?:boolean}) {
 const returnTo=checkoutReturn();
 const signIn=returnTo?accountUrl(returnTo):'/account';
 const [recovery]=useState(()=>{
  const url=new URL(window.location.href);
  const hash=new URLSearchParams(url.hash.slice(1));
  return {
   tokenHash:hash.get('token_hash') || url.searchParams.get('token_hash') || '',
   accessToken:hash.get('type')==='recovery' ? hash.get('access_token') || '' : '',
   linkError:hash.get('error_description') || url.searchParams.get('error_description') || '',
  };
 });
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{
  document.title=(reset?'Reset password':'Forgot password')+' | QuickSub';
  if(reset)window.history.replaceState(window.history.state,'','/reset-password');
  return()=>{document.title='QuickSub';};
 },[reset]);
 return <div className="min-h-screen bg-page text-ink-800"><PageNavigation current="account"/><main className="max-w-lg mx-auto px-4 py-10 space-y-5"><SiteLink href={signIn} className="text-brand-600 font-semibold">← Back to sign in</SiteLink><section className="bg-white border border-brand-100 rounded-2xl p-5 sm:p-7 space-y-5"><h1 className="text-2xl font-bold">{reset?'Reset your password':'Forgot your password?'}</h1><p className="text-sm text-ink-500">{reset?'Choose a strong password with at least 10 characters.':'Enter your account email and we will send you a secure reset link.'}</p>
 {error&&<p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3">{error}</p>}{message&&<p role="status" className="rounded-xl bg-green-50 text-green-800 p-3">{message}</p>}
 {reset&&!recovery.tokenHash&&!recovery.accessToken?<p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3">{recovery.linkError?'This reset link is invalid or has expired. Request a new reset link below.':'Open the password reset link from your email. If it has expired, request a new one below.'}</p>:done?(reset?<SiteLink href={signIn} className={button+' block text-center'}>Sign in with new password</SiteLink>:<button type="button" className="text-brand-600 underline" onClick={()=>{setDone(false);setMessage('');}}>Try another email</button>):<form className="space-y-4" onSubmit={async e=>{
 e.preventDefault();const form=e.currentTarget;const data=new FormData(form);setError('');setMessage('');
 if(reset&&data.get('password')!==data.get('confirmPassword')){setError('The passwords do not match.');return;}
 setBusy(true);try{
 const result=await api<{message:string}>(reset?'/account/reset-password':'/account/forgot-password',reset?{...(recovery.tokenHash?{tokenHash:recovery.tokenHash}:{accessToken:recovery.accessToken}),password:data.get('password'),confirmPassword:data.get('confirmPassword')}:{email:data.get('email')});
 form.reset();setMessage(result.message);setDone(true);
 }catch(err){setError((err as Error).message);}finally{setBusy(false);}
 }}>
 {reset?<><label className="block">New password<input className={field} name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label><label className="block">Confirm new password<input className={field} name="confirmPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128}/></label></>:<label className="block">Email<input className={field} name="email" type="email" autoComplete="email" placeholder="yourname@gmail.com" required maxLength={254}/></label>}
 <button className={button} disabled={busy}>{busy?'Please wait…':reset?'Save new password':'Send reset link'}</button>
 </form>}
 {reset&&!done&&<SiteLink href="/forgot-password" className="inline-block text-brand-600 underline">Request a new reset link</SiteLink>}
 </section></main></div>;
}
