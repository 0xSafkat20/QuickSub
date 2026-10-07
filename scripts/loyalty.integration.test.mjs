import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { startTestServer, packageId } from './admin-test-server.mjs';

test('loyalty, referrals, redemption, refunds and locale preferences are transactional',async()=>{
 const env=await startTestServer({paymentEnv:{CRON_SECRET:'test-loyalty-cron-secret'}});
 try{
  const request=async(path,body,cookie='',method=body===undefined?'GET':'POST')=>{const response=await fetch(env.base+'/api'+path,{method,headers:{origin:env.base,'x-quicksub-client':'web','content-type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const signup=async(email,referralCode)=>request('/account/signup',{name:email.split('@')[0],email,password:'example-password-123',locale:'en-BD',...(referralCode?{referralCode}:{})});
  const referrer=await signup('loyal-referrer@example.test');assert.equal(referrer.status,200,JSON.stringify(referrer.body));
  const referrerRewards=await request('/account/rewards',undefined,referrer.cookie);assert.equal(referrerRewards.status,200);assert.match(referrerRewards.body.referralCode,/^[A-F0-9]{8}$/);
  const referred=await signup('loyal-friend@example.test',referrerRewards.body.referralCode);assert.equal(referred.status,200);
  assert.equal((await request('/account/referral',{code:referrerRewards.body.referralCode},referrer.cookie)).status,409);

  const credentials={id:randomUUID(),accessCode:randomBytes(32).toString('hex'),packageId,name:'Friend',contact:'loyal-friend@example.test',note:'',email:'loyal-friend@example.test',gameAccount:'',expectedPrice:299,fromCart:false,points:0};
  const order=await request('/orders',credentials,referred.cookie);assert.equal(order.status,201);assert.equal(Number(order.body.order.amount_bdt),299);
  await env.db.query("update quicksub_orders set payment_status='verified',status='delivered' where id=$1",[credentials.id]);
  const earned=await request('/account/rewards',undefined,referred.cookie);assert.equal(earned.body.balance,29);assert.equal(earned.body.referrals.total,0);
  assert.equal(Number(earned.body.settings.bdt_per_point),0.25);assert.equal(earned.body.lifetimeEarned,29);
  const pending=await env.db.query("select status from quicksub_referrals where referred_id=(select user_id from quicksub_customers where contact='loyal-friend@example.test')");assert.equal(pending.rows[0].status,'pending');
  await env.db.query("update quicksub_referrals set eligible_at=now()-interval '1 second'");
  const welcomed=await request('/account/rewards',undefined,referred.cookie);assert.equal(welcomed.body.balance,79);
  const rewardedReferrer=await request('/account/rewards',undefined,referrer.cookie);assert.equal(rewardedReferrer.body.balance,100);assert.equal(rewardedReferrer.body.referrals.rewarded,1);

  const discounted={...credentials,id:randomUUID(),accessCode:randomBytes(32).toString('hex'),contact:'loyal-referrer@example.test',email:'loyal-referrer@example.test',points:100};
  const discountedOrder=await request('/orders',discounted,referrer.cookie);assert.equal(discountedOrder.status,201);assert.equal(Number(discountedOrder.body.order.loyalty_discount_bdt),25);assert.equal(Number(discountedOrder.body.order.amount_bdt),274);
  assert.equal((await request('/account/rewards',undefined,referrer.cookie)).body.balance,0);
  await env.db.query("update quicksub_orders set status='cancelled' where id=$1",[discounted.id]);
  assert.equal((await request('/account/rewards',undefined,referrer.cookie)).body.balance,100);

  await env.db.query("update quicksub_orders set payment_status='refunded' where id=$1",[credentials.id]);
  const reversed=await request('/account/rewards',undefined,referred.cookie);assert.equal(reversed.body.balance,0);
  assert.equal(reversed.body.lifetimeEarned,0);assert.equal(reversed.body.transactions.some(item=>item.order_id===credentials.id),false);assert.equal(reversed.body.transactions.some(item=>item.kind==='refund-reversal'),false);
  assert.equal((await request('/account/rewards',undefined,referrer.cookie)).body.balance,0);
  const referralState=await env.db.query('select status,rejection_reason from quicksub_referrals');assert.equal(referralState.rows[0].status,'rejected');assert.match(referralState.rows[0].rejection_reason,/refunded/i);

  const locale=await request('/account/profile',{name:'Friend',contact:'loyal-friend@example.test',renewal_reminders:true,preferred_locale:'bn-BD'},referred.cookie);assert.equal(locale.status,200);
  const session=await request('/account/session',undefined,referred.cookie);assert.equal(session.body.profile.preferred_locale,'bn-BD');
  assert.equal((await request('/account/profile',{name:'Friend',contact:'loyal-friend@example.test',renewal_reminders:true,preferred_locale:'fr-FR'},referred.cookie)).status,400);
  assert.equal((await request('/account/locale',{locale:'en-BD'},referred.cookie)).status,200);
  assert.equal((await request('/account/locale',{locale:'fr-FR'},referred.cookie)).status,400);

  const owner=await request('/admin/login',{email:'owner@example.test',password:'test-password'});assert.equal(owner.status,200);
  const dashboard=await request('/admin/loyalty',undefined,owner.cookie);assert.equal(dashboard.status,200);assert.ok(dashboard.body.settings);
  const settings={...dashboard.body.settings,points_per_10_bdt:2,bdt_per_point:0.5,minimum_redemption:100,maximum_discount_percent:20,referral_reward:120,referred_reward:60,referral_wait_days:5,monthly_referral_limit:12,enabled:true};
  assert.equal((await request('/admin/loyalty/settings',settings,owner.cookie,'PUT')).status,200);
  assert.equal((await request('/admin/loyalty/settings',{...settings,maximum_discount_percent:101},owner.cookie,'PUT')).status,400);
  const customerId=(await env.db.query("select user_id from quicksub_customers where contact='loyal-referrer@example.test'")).rows[0].user_id;
  assert.equal((await request('/admin/loyalty/adjust',{customerId,points:25,reason:'Service recovery credit'},owner.cookie)).status,200);
  assert.equal((await request('/account/rewards',undefined,referrer.cookie)).body.balance,25);
  assert.equal((await request('/admin/loyalty/adjust',{customerId,points:-100,reason:'Invalid excessive removal'},owner.cookie)).status,409);
  const staff=await request('/admin/login',{email:'staff@example.test',password:'test-password'});assert.equal((await request('/admin/loyalty',undefined,staff.cookie)).status,403);
  assert.equal((await fetch(env.base+'/api/jobs/loyalty')).status,401);
  const job=await fetch(env.base+'/api/jobs/loyalty',{headers:{authorization:'Bearer test-loyalty-cron-secret'}});assert.equal(job.status,200);assert.equal(typeof (await job.json()).processed,'number');
 }finally{await env.close();}
});
