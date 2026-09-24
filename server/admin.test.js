const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createAdminRouter}=require('./admin');
async function setup(t,options){
 const app=express();app.use(express.json({limit:'16kb'}));app.use('/api',createAdminRouter(options));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 return async(path,body)=>{const response=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json','X-QuickSub-Client':'web'},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json()};};
}
test('unconfigured admin API fails closed while public catalog helpers remain usable',async t=>{
 const call=await setup(t,{url:'',key:'',fetchImpl:()=>{throw Error('Must not access network');}});
 assert.deepEqual((await call('/store')).data,{settings:{},faq:null});
 assert.deepEqual((await call('/packages/1')).data,{packages:[]});
 assert.equal((await call('/admin/data')).status,401);
 assert.equal((await call('/admin/login',{email:'admin@example.test',password:'password'})).status,503);
});
test('local preview exposes seeded packages as simulation-only plans',async t=>{
 const call=await setup(t,{url:'',key:'',previewCheckout:true,fetchImpl:()=>{throw Error('Must not access network');}});
 const available=(await call('/packages/1')).data.packages;
 assert.equal(available.length,1);assert.equal(available[0].name,'1 Month Premium');assert.equal(available[0].price_bdt,299);assert.equal(available[0].demo,true);assert.match(available[0].id,/^preview-/);
 assert.deepEqual((await call('/packages/5')).data,{packages:[]});
});
test('network errors return safe outage messages without leaking credentials',async t=>{
 const call=await setup(t,{url:'https://test.example',key:'private-secret',fetchImpl:async()=>{throw Error('private-secret upstream details');}});
 const r=await call('/admin/login',{email:'admin@example.test',password:'password'});assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r.data),/private-secret|upstream details/);
});
test('provider authentication failures do not expose account existence or provider body',async t=>{
 const call=await setup(t,{url:'https://test.example',key:'secret',fetchImpl:async()=>new Response(JSON.stringify({error:'account details secret'}),{status:400})});
 const r=await call('/admin/login',{email:'admin@example.test',password:'password'});assert.equal(r.status,401);assert.doesNotMatch(JSON.stringify(r.data),/account details|secret/);
});
test('invalid login fields are rejected before any provider request',async t=>{
 let requests=0;const call=await setup(t,{url:'https://test.example',key:'secret',fetchImpl:async()=>{requests++;throw Error('unexpected');}});
 for(const body of [{},{email:'admin@example.test'},{email:42,password:'pw'},{email:'x',password:''},{email:'x',password:'x'.repeat(257)}])assert.equal((await call('/admin/login',body)).status,400);
 assert.equal(requests,0);
});
