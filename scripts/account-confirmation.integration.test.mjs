import test from 'node:test';
import assert from 'node:assert/strict';
import {startTestServer} from './admin-test-server.mjs';

test('email confirmation explains blocked login, resends safely and establishes a two-hour session',async()=>{
 const env=await startTestServer({emailConfirmation:true});
 try {
  const request=async(path,body,cookie='')=>{
   const response=await fetch(env.base+'/api/account/'+path,{method:body===undefined?'GET':'POST',headers:{origin:env.base,'x-quicksub-client':'web','content-type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],setCookie:response.headers.get('set-cookie')};
  };
  const credentials={email:'confirm@example.test',password:'confirmation-password-123'};
  const signup=await request('signup',{name:'Confirmation Tester',...credentials});
  assert.equal(signup.status,200);
  assert.equal(signup.body.signedIn,false);
  assert.equal(signup.cookie,undefined);

  const blocked=await request('login',credentials);
  assert.equal(blocked.status,403);
  assert.match(blocked.body.error,/confirm your email/i);
  const wrong=await request('login',{email:credentials.email,password:'wrong-password'});
  assert.equal(wrong.status,401);
  assert.doesNotMatch(wrong.body.error,/confirm your email/i);

  const resent=await request('resend-confirmation',{email:credentials.email});
  const unknown=await request('resend-confirmation',{email:'unknown@example.test'});
  assert.equal(resent.status,200);
  assert.deepEqual(resent.body,unknown.body);

  const rows=await env.db.query("select id from auth.users where id not in ($1,$2)",['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002']);
  const token=rows.rows[0].id;
  const confirmed=await request('confirm',{accessToken:token,refreshToken:token});
  assert.equal(confirmed.status,200);
  assert.match(confirmed.setCookie,/Max-Age=7200/);
  const session=await request('session',undefined,confirmed.cookie);
  assert.equal(session.body.user.email,credentials.email);
  assert.equal((await request('confirm',{accessToken:'invalid-confirmation-access-token',refreshToken:'invalid-confirmation-refresh-token'})).status,400);
 } finally {await env.close();}
});