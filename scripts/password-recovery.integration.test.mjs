import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer} from './admin-test-server.mjs';

test('password recovery validates links, changes passwords and revokes sessions',async()=>{
 const env=await startTestServer();
 try{
  const request=async(path,body,cookie='')=>{
   const r=await fetch(env.base+'/api/account/'+path,{method:body===undefined?'GET':'POST',headers:{origin:env.base,'x-quicksub-client':'web','content-type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
  const email='recovery@example.test',password='original-password-123';
  const signup=await request('signup',{name:'Recovery Tester',email,password});assert.equal(signup.status,200);
  const session=await request('session',undefined,signup.cookie);
  const known=await request('forgot-password',{email});
  const unknown=await request('forgot-password',{email:'unknown@example.test'});
  assert.equal(known.status,200);assert.deepEqual(known.body,unknown.body);
  const tokenHash='test-recovery-'+session.body.user.id,newPassword='replacement-password-123';
  assert.equal((await request('reset-password',{tokenHash,password:newPassword,confirmPassword:'different-password'})).status,400);
  assert.equal((await request('reset-password',{tokenHash,password:newPassword,confirmPassword:newPassword})).status,200);
  assert.equal((await request('orders',undefined,signup.cookie)).status,401);
  assert.equal((await request('login',{email,password})).status,401);
  assert.equal((await request('login',{email,password:newPassword})).status,200);
  assert.equal((await request('reset-password',{tokenHash,password:newPassword,confirmPassword:newPassword})).status,400);
  assert.equal((await request('forgot-password',{email:'invalid'})).status,400);
  assert.equal((await request('forgot-password',{email})).status,429);
 }finally{await env.close();}
});
