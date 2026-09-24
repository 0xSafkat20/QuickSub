import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const express=require('../server/node_modules/express');
const {createAdminRouter}=require('../server/admin');
test('shared admin sessions survive instance changes and revoke on logout',async t=>{
 const rows=new Map(); let clock=Date.now();
 const user={id:'10000000-0000-4000-8000-000000000001',email:'owner@example.test'};
 const fetchImpl=async(url,options={})=>{
  const u=new URL(url); const body=options.body?JSON.parse(options.body):null;
  const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
  if(u.pathname==='/auth/v1/token')return json({user,access_token:'private-token',refresh_token:'private-refresh',expires_in:3600});
  if(u.pathname==='/auth/v1/user')return json(user);
  if(u.pathname.endsWith('/quicksub_admins'))return json([{role:'owner'}]);
  if(u.pathname.endsWith('/quicksub_admin_sessions')){
   const id=u.searchParams.get('id')?.slice(3);
   if(options.method==='POST'){rows.set(body.id,body);return new Response(null,{status:204});}
   if(options.method==='PATCH'){if(rows.has(id))rows.set(id,{...rows.get(id),...body});return new Response(null,{status:204});}
   if(options.method==='DELETE'){rows.delete(id);return new Response(null,{status:204});}
   return json(rows.has(id)?[rows.get(id)]:[]);
  }
  throw Error('Unexpected request '+u.pathname);
 };
 async function instance(){
  const app=express(); app.use(express.json()); app.use('/api',createAdminRouter({url:'https://test.example',key:'key',fetchImpl,sharedSessions:true,now:()=>clock}));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port;
 }
 const first=await instance(),second=await instance();
 const call=(base,path,body,cookie='')=>fetch(base+'/api/admin/'+path,{method:body?'POST':'GET',headers:{Origin:base,'X-QuickSub-Client':'web','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});
 const login=await call(first,'login',{email:user.email,password:'password'}); assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0]; assert.equal(rows.size,1);
 assert.notEqual([...rows.keys()][0],cookie.split('=')[1]);
 assert.equal((await call(second,'session',null,cookie)).status,200);
 assert.equal((await call(second,'logout',{},cookie)).status,200);
 assert.equal((await call(first,'session',null,cookie)).status,401);
 const again=await call(first,'login',{email:user.email,password:'password'});
 clock+=3600001;
 const stillActive=await call(second,'session',null,again.headers.get('set-cookie').split(';')[0]);
 assert.equal(stillActive.status,200);
 clock+=3600000;
 assert.equal((await call(second,'session',null,again.headers.get('set-cookie').split(';')[0])).status,401);
});
