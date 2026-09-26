import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import {startTestServer,packageId,ownerId} from './admin-test-server.mjs';

test('Boundary, authorization and transaction regressions',async t=>{
 let clock=Date.now();const env=await startTestServer({now:()=>clock,password:' padded password '});t.after(()=>env.close());
 const call=async(path,body,cookie='',method=body===undefined?'GET':'POST',headers={})=>{
  const response=await fetch(env.base+'/api'+path,{method,headers:{Origin:env.base,'Content-Type':'application/json','X-QuickSub-Client':'web',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,headers:response.headers,data:await response.json()};
 };
 let cookie;
 await t.test('password whitespace is preserved and session cookie is private',async()=>{
  assert.equal((await call('/admin/login',{email:'owner@example.test',password:'padded password'})).status,401);
  const r=await call('/admin/login',{email:'owner@example.test',password:' padded password '});assert.equal(r.status,200);const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly/i);assert.match(c,/SameSite=Strict/i);assert.match(c,/Path=\/api\/admin/);assert.equal(r.data.access_token,undefined);cookie=c.split(';')[0];
 });
 for(const [name,headers] of [['missing origin',{Origin:''}],['missing CSRF header',{'X-QuickSub-Client':''}],['cross origin',{Origin:'https://untrusted.example'}]])await t.test(name,async()=>assert.equal((await call('/admin/logout',{},cookie,'POST',headers)).status,403));
 await t.test('fractional pagination is normalized to an integer',async()=>{const r=await call('/admin/data?offset=0.5',undefined,cookie);assert.equal(r.status,200);assert.equal(r.data.offset,0);});
 for(const [name,body] of [
  ['null FAQ',{faq:[null],policies:{},operations:{}}],
  ['null policy',{faq:[],policies:{Terms:null},operations:{}}],
  ['null policy section',{faq:[],policies:{Terms:{title:'Terms',lastUpdated:'today',sections:[null]}},operations:{}}],
  ['invalid operations',{faq:[],policies:{},operations:[]}],
  ['too many FAQ entries',{faq:Array(41).fill({id:'1',question:'q',answer:'a'}),policies:{},operations:{}}],
 ])await t.test(name+' is a validation error, not server failure',async()=>assert.equal((await call('/admin/content/store',body,cookie,'PUT')).status,400));
 await t.test('empty published FAQ and offer lists remain empty',async()=>{
  assert.equal((await call('/admin/content/store',{faq:[],policies:{},operations:{}},cookie,'PUT')).status,200);
  assert.deepEqual((await call('/store')).data.faq,[]);
  assert.equal((await call('/admin/content/settings',{paymentInstructions:'',supportHours:'',dealEndsAt:'',deals:[]},cookie,'PUT')).status,200);
  assert.deepEqual((await call('/store')).data.settings.deals,[]);
 });
 for(const [kind,id,body] of [['unknown','1',{}],['package','bad-id',{}],['package',packageId,{product_id:'1',name:'Plan',details:'',price_bdt:-1,active:true}],['order',randomUUID(),{status:'wrong',payment_status:'verified',delivery_note:''}],['request',randomUUID(),{status:'deleted'}],['content','unknown',{}]])await t.test('rejects invalid '+kind+' mutation '+id.slice(0,8),async()=>assert.ok([400,404].includes((await call('/admin/'+kind+'/'+id,body,cookie,'PUT')).status)));
 await t.test('punctuation-only contact is rejected',async()=>{assert.equal((await call('/requests',{kind:'support',contact:'--------',message:'Help'})).status,400);});
 await t.test('request rate limits have Retry-After and reset',async()=>{clock+=60001;for(let i=0;i<5;i++)assert.equal((await call('/requests',{kind:'support',contact:'buyer@example.test',message:'Help'})).status,200);const r=await call('/requests',{kind:'support',contact:'buyer@example.test',message:'Help'});assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');clock+=60001;assert.equal((await call('/requests',{kind:'newsletter',contact:'buyer@example.test'})).status,200);});
 const payload={id:randomUUID(),accessCode:randomBytes(32).toString('hex'),packageId,name:'Customer',contact:'buyer@example.test',note:'',expectedPrice:299};
 await t.test('simultaneous identical requests create one SQL order',async()=>{const [a,b]=await Promise.all([call('/orders',payload),call('/orders',payload)]);assert.equal(a.status,201);assert.equal(b.status,201);assert.equal((await env.db.query('select count(*)::int n from quicksub_orders where id=$1',[payload.id])).rows[0].n,1);});
 await t.test('failed fulfillment explains the payment rule and leaves both order and audit unchanged',async()=>{const before=(await env.db.query('select count(*)::int n from quicksub_audit')).rows[0].n;const result=await call('/admin/order/'+payload.id,{status:'delivered',payment_status:'unpaid',delivery_note:'Done'},cookie,'PUT');assert.equal(result.status,409);assert.match(result.data.error,/Set Payment status to verified/i);const row=(await env.db.query('select status,payment_status from quicksub_orders where id=$1',[payload.id])).rows[0];assert.deepEqual(row,{status:'pending',payment_status:'unpaid'});assert.equal((await env.db.query('select count(*)::int n from quicksub_audit')).rows[0].n,before);});
 await t.test('refunds remove revenue and cannot be reversed',async()=>{
  await call('/orders/payment',{...payload,reference:'TEST-REF-01'});
  assert.equal((await call('/admin/order/'+payload.id,{status:'processing',payment_status:'verified',delivery_note:''},cookie,'PUT')).status,200);
  assert.equal((await call('/admin/order/'+payload.id,{status:'cancelled',payment_status:'refunded',delivery_note:'Refund processed'},cookie,'PUT')).status,200);
  assert.equal(Number((await call('/admin/data',undefined,cookie)).data.overview.revenue),0);
  assert.equal((await call('/admin/order/'+payload.id,{status:'cancelled',payment_status:'verified',delivery_note:''},cookie,'PUT')).status,409);
  assert.equal((await call('/admin/order/'+payload.id,{status:'pending',payment_status:'refunded',delivery_note:''},cookie,'PUT')).status,409);
 });
 await t.test('anonymous and ordinary authenticated users cannot read protected tables or execute RPCs',async()=>{for(const role of ['anon','authenticated']){for(const table of ['quicksub_admins','quicksub_products','quicksub_packages','quicksub_orders','quicksub_audit','quicksub_content','quicksub_requests']){const r=await env.db.query('select has_table_privilege($1,$2,\'select\') allowed',[role,table]);assert.equal(r.rows[0].allowed,false,role+' '+table);}for(const signature of ['quicksub_create_order(uuid,text,uuid,text,text,text,numeric)','quicksub_admin_write(uuid,text,text,jsonb)','quicksub_overview()','quicksub_customers(integer)'])assert.equal((await env.db.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,signature])).rows[0].allowed,false);}});
 await t.test('session expiration rejects previously valid cookies',async()=>{clock+=7200001;assert.equal((await call('/admin/session',undefined,cookie)).status,401);});
 await t.test('login rate limit resets after a minute',async()=>{clock+=60001;for(let i=0;i<6;i++)assert.equal((await call('/admin/login',{email:'owner@example.test',password:'wrong'})).status,401);assert.equal((await call('/admin/login',{email:'owner@example.test',password:' padded password '})).status,429);clock+=60001;assert.equal((await call('/admin/login',{email:'owner@example.test',password:' padded password '})).status,200);});
});
