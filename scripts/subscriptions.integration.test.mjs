import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { startTestServer, packageId } from './admin-test-server.mjs';

const password='subscription-password-123';
test('subscription lifecycle, renewal, reminders, ownership and admin controls',async()=>{
 const env=await startTestServer();
 try{
  const request=async(path,{body,method,cookie}={})=>{const response=await fetch(env.base+'/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{origin:env.base,'x-quicksub-client':'web','content-type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null,cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const signup=async(email)=>request('/account/signup',{body:{name:'Subscriber',email,password}});
  const alice=await signup('subscriber@example.test'),bob=await signup('other-subscriber@example.test');
  assert.equal(alice.status,200);assert.equal(bob.status,200);
  const session=(await request('/account/session',{cookie:alice.cookie})).body;
  const order={id:randomUUID(),accessCode:randomBytes(32).toString('hex'),packageId,expectedPrice:299,name:'Subscriber',contact:'subscriber@example.test',email:'subscriber@example.test',note:''};
  assert.equal((await request('/orders',{body:order,cookie:alice.cookie})).status,201);
  await env.db.query("update quicksub_orders set payment_status='verified' where id=$1",[order.id]);
  let list=await request('/account/subscriptions',{cookie:alice.cookie});
  assert.equal(list.status,200);assert.equal(list.body.subscriptions.length,1);
  const original=list.body.subscriptions[0];
  assert.equal(original.status,'active');assert.equal(original.order_id,order.id);assert.equal(original.customer_id,undefined);assert.equal(original.device_limit,1);
  assert.ok(Date.parse(original.ends_at)>Date.parse(original.starts_at));
  assert.equal((await env.db.query('select count(*)::int n from quicksub_subscriptions where order_id=$1',[order.id])).rows[0].n,1);
  await env.db.query("update quicksub_orders set payment_status='verified' where id=$1",[order.id]);
  assert.equal((await env.db.query('select count(*)::int n from quicksub_subscriptions where order_id=$1',[order.id])).rows[0].n,1);
  assert.equal((await request('/account/subscriptions/'+original.id,{cookie:bob.cookie})).status,404);
  assert.equal((await request('/account/subscriptions/'+original.id+'/renew',{body:{},cookie:bob.cookie})).status,409);
  const detail=await request('/account/subscriptions/'+original.id,{cookie:alice.cookie});assert.equal(detail.body.subscription.id,original.id);
  const renew=await request('/account/subscriptions/'+original.id+'/renew',{body:{},cookie:alice.cookie});assert.equal(renew.status,200);assert.match(renew.body.checkout,/renewal=/);

  const sourceEnd=new Date(Date.now()+12*60*60*1000).toISOString();
  await env.db.query("update quicksub_subscriptions set ends_at=$1 where id=$2",[sourceEnd,original.id]);
  await env.db.query('select quicksub_sync_subscription_reminders($1)',[original.id]);
  list=await request('/account/subscriptions',{cookie:alice.cookie});assert.ok(list.body.reminders.length>=1);
  const reminder=list.body.reminders[0];
  assert.equal((await request('/account/subscriptions/reminders/'+reminder.id+'/read',{body:{},cookie:bob.cookie})).status,404);
  assert.equal((await request('/account/subscriptions/reminders/'+reminder.id+'/read',{body:{},cookie:alice.cookie})).status,200);

  const renewalOrder={...order,id:randomUUID(),accessCode:randomBytes(32).toString('hex'),renewalOf:original.id};
  assert.equal((await request('/orders',{body:renewalOrder,cookie:alice.cookie})).status,201);
  await env.db.query("update quicksub_orders set payment_status='verified' where id=$1",[renewalOrder.id]);
  list=await request('/account/subscriptions',{cookie:alice.cookie});assert.equal(list.body.subscriptions.length,2);
  const renewed=list.body.subscriptions.find(s=>s.order_id===renewalOrder.id);assert.ok(renewed);assert.equal(renewed.status,'upcoming');assert.equal(renewed.renewed_from,original.id);assert.equal(Date.parse(renewed.starts_at),Date.parse(sourceEnd));
  const wrongPackage=randomUUID();await env.db.query("insert into quicksub_packages(id,product_id,name,price_bdt,details) values($1,'1','Other · 1 month',399,'1 device')",[wrongPackage]);
  const invalid={...renewalOrder,id:randomUUID(),accessCode:randomBytes(32).toString('hex'),packageId:wrongPackage,expectedPrice:399};
  assert.equal((await request('/orders',{body:invalid,cookie:alice.cookie})).status,409);

  const admin=await request('/admin/login',{body:{email:'owner@example.test',password:'test-password'}});assert.equal(admin.status,200);
  let adminList=await request('/admin/subscriptions',{cookie:admin.cookie});assert.equal(adminList.status,200);assert.equal(adminList.body.subscriptions.length,2);
  const extended=new Date(Date.parse(renewed.ends_at)+86400000).toISOString();
  const changed=await request('/admin/subscriptions/'+renewed.id,{method:'PUT',cookie:admin.cookie,body:{status:'suspended',ends_at:extended,device_limit:3,account_reference:'Account ending 42',delivery_instructions:'Use the assigned profile. Contact support for access recovery.'}});assert.equal(changed.status,200);
  assert.equal(changed.body.subscription.status,'suspended');assert.equal(changed.body.subscription.device_limit,3);
  assert.equal((await env.db.query("select count(*)::int n from quicksub_audit where action='subscription-update'")).rows[0].n,1);
  await env.db.query("update quicksub_subscriptions set starts_at=now()-interval '1 month',ends_at=now()-interval '1 minute',status='active' where id=$1",[original.id]);
  const processed=await request('/admin/subscriptions/process',{body:{},cookie:admin.cookie});assert.equal(processed.status,200);assert.equal(processed.body.expired,1);
  assert.equal((await env.db.query('select status from quicksub_subscriptions where id=$1',[original.id])).rows[0].status,'expired');
  const receipts=await request('/account/subscriptions/'+original.id+'/receipts',{cookie:alice.cookie});assert.equal(receipts.status,200);assert.equal(receipts.body.receipts[0].id,order.id);assert.equal(receipts.body.receipts[0].tracking_hash,undefined);
  for(const table of ['quicksub_subscriptions','quicksub_subscription_reminders'])for(const role of ['anon','authenticated'])assert.equal((await env.db.query('select has_table_privilege($1,$2,\'select\') allowed',[role,table])).rows[0].allowed,false);
  assert.equal((await env.db.query("select has_function_privilege('anon','quicksub_admin_subscription(uuid,uuid,text,timestamptz,integer,text,text)','EXECUTE') allowed")).rows[0].allowed,false);
  assert.equal(session.user.email,'subscriber@example.test');
 }finally{await env.close();}
});
