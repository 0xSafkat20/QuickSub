import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {startTestServer,packageId} from './admin-test-server.mjs';

test('account cart ownership, persistence, validation and transactional checkout',async t=>{
 let clock=Date.now();const env=await startTestServer({now:()=>clock});t.after(()=>env.close());
 const call=async(path,body,cookie='',method=body===undefined?'GET':'POST',extra={})=>{
  const r=await fetch(env.base+'/api'+path,{method,headers:{origin:env.base,'x-quicksub-client':'web','content-type':'application/json',cookie,...extra},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 };
 const credentials={email:'cart@example.test',password:'cart-test-password'};
 const a=(await call('/account/signup',{name:'Alice',...credentials})).cookie;
 const b=(await call('/account/signup',{name:'Bob',email:'bob-cart@example.test',password:'cart-test-password'})).cookie;
 let active=a;
 const details={name:'Alice',contact:'alice@example.test',note:'Saved on another device'};
 const item='/cart/items/'+packageId;
 await t.test('all cart routes require a customer session and writes require trusted origin',async()=>{
  for(const [path,body,method] of [['/cart',undefined,'GET'],[item,details,'PUT'],[item,undefined,'DELETE']])assert.equal((await call(path,body,'',method)).status,401);
  assert.equal((await call(item,details,a,'PUT',{origin:'https://evil.example'})).status,403);
 });
 await t.test('strict input validation rejects forged owners, prices, invalid fields and package IDs',async()=>{
  for(const body of [null,[],{...details,user_id:'forged'},{...details,price_bdt:1},{...details,note:'x'.repeat(1001)},{...details,contact:'invalid'}])assert.equal((await call(item,body,a,'PUT')).status,400);
  assert.equal((await call('/cart/items/not-a-uuid',details,a,'PUT')).status,400);
  assert.equal((await call('/cart/items/'+randomUUID(),details,a,'PUT')).status,409);
 });
 await t.test('repeated and concurrent saves upsert one package; accounts cannot see or delete each other’s items',async()=>{
  const saves=await Promise.all([call(item,details,a,'PUT'),call(item,details,a,'PUT')]);assert.ok(saves.every(r=>r.status===200));
  let cart=await call('/cart',undefined,a);assert.equal(cart.data.items.length,1);assert.equal(cart.data.items[0].price_bdt,299);
  assert.equal((await call('/cart',undefined,b)).data.items.length,0);
  assert.equal((await call(item,undefined,b,'DELETE')).status,200);
  assert.equal((await call('/cart',undefined,a)).data.items.length,1);
  assert.equal((await call(item,{...details,note:'Updated details'},a,'PUT')).status,200);
  assert.equal((await call('/cart',undefined,a)).data.items[0].note,'Updated details');
 });
 await t.test('second login restores cart without browser storage; expiry does not delete cart',async()=>{
  const second=await call('/account/login',credentials);
  assert.equal((await call('/cart',undefined,second.cookie)).data.items.length,1);
  clock+=7200000;
  assert.equal((await call('/cart',undefined,a)).status,401);
  const again=await call('/account/login',credentials);
  assert.equal((await call('/cart',undefined,again.cookie)).data.items[0].note,'Updated details');
  // Continue under the new session for remaining cases.
  active=again.cookie;
 });
 await t.test('current prices and unavailable packages are reflected; failed checkout retains the cart',async()=>{
  await env.db.query('update quicksub_packages set price_bdt=399 where id=$1',[packageId]);
  const cart=await call('/cart',undefined,active);assert.equal(cart.data.items[0].price_bdt,399);
  const payload={id:randomUUID(),accessCode:randomBytes(32).toString('hex'),packageId,...details,expectedPrice:299,fromCart:true};
  assert.equal((await call('/orders',payload,active)).status,409);
  assert.equal((await call('/cart',undefined,active)).data.items.length,1);
  assert.equal((await env.db.query('select count(*)::int n from quicksub_orders where id=$1',[payload.id])).rows[0].n,0);
  await env.db.query('update quicksub_packages set active=false where id=$1',[packageId]);
  assert.equal((await call('/cart',undefined,active)).data.items[0].available,false);
  assert.equal((await call(item,details,active,'PUT')).status,409);
  assert.equal((await call('/orders',{...payload,expectedPrice:399},active)).status,409);
  await env.db.query('update quicksub_packages set active=true where id=$1',[packageId]);
 });
 await t.test('successful checkout atomically removes only its item, creates one owned order, and retries cannot remove re-added items',async()=>{
  const payload={id:randomUUID(),accessCode:randomBytes(32).toString('hex'),packageId,...details,expectedPrice:399,fromCart:true};
  const result=await Promise.all([call('/orders',payload,active),call('/orders',payload,active)]);
  assert.ok(result.every(r=>r.status===201));
  assert.equal((await call('/cart',undefined,active)).data.items.length,0);
  assert.equal((await call('/account/orders',undefined,active)).data.orders[0].id,payload.id);
  assert.equal((await env.db.query('select count(*)::int n from quicksub_orders where id=$1',[payload.id])).rows[0].n,1);
  await call(item,details,active,'PUT');
  assert.equal((await call('/orders',payload,active)).status,201);
  assert.equal((await call('/cart',undefined,active)).data.items.length,1);
  clock+=60001;
  assert.equal((await call('/orders',{...payload,id:randomUUID()},'')).status,401);
 });
 await t.test('cart limit is enforced in SQL and permits updating existing items',async()=>{
  const user=(await call('/account/session',undefined,active)).data.user.id;
  for(let i=0;i<19;i++){
   const id=randomUUID();await env.db.query("insert into quicksub_packages(id,product_id,name,price_bdt) values($1,'1',$2,99)",[id,'Extra '+i]);
   await env.db.query("select quicksub_save_cart_item($1,$2,'','','')",[user,id]);
  }
  const id=randomUUID();await env.db.query("insert into quicksub_packages(id,product_id,name,price_bdt) values($1,'1','Over limit',99)",[id]);
  assert.equal((await call('/cart/items/'+id,details,active,'PUT')).status,409);
  assert.equal((await call(item,details,active,'PUT')).status,200);
  assert.equal((await call('/cart',undefined,active)).data.items.length,20);
  await call(item,undefined,active,'DELETE');
  assert.equal((await call('/cart',undefined,active)).data.items.length,19);
 });
 await t.test('public database roles cannot read cart details or execute cart functions',async()=>{
  for(const role of ['anon','authenticated']){
   assert.equal((await env.db.query("select has_table_privilege($1,'quicksub_cart_items','select') allowed",[role])).rows[0].allowed,false);
   for(const fn of ['quicksub_cart(uuid)','quicksub_save_cart_item(uuid,uuid,text,text,text)','quicksub_checkout_cart(uuid,uuid,text,uuid,text,text,text,numeric)'])assert.equal((await env.db.query("select has_function_privilege($1,$2,'execute') allowed",[role,fn])).rows[0].allowed,false);
  }
 });
});
