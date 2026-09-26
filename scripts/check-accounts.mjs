import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {mkdir} from 'node:fs/promises';
import {startTestServer,packageId} from './admin-test-server.mjs';
const env=await startTestServer();let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:390,height:844});
 await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(env.base)||r.url().startsWith('data:')?r.continue():r.abort());
 await page.goto(env.base+'/account',{waitUntil:'networkidle0'});
 const click=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t),{},text);await page.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t).click(),text);};
 await click('New here? Create an account');
 await page.type('[name="name"]','Account Tester');await page.type('[name="email"]','customer@example.test');await page.type('[name="password"]','test-password-123');await click('Create account');
 await page.waitForFunction(()=>document.body.innerText.includes('Signed in as'));
 await page.waitForFunction(()=>document.body.innerText.includes('No orders yet'));
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.innerText.includes('Account Tester')||document.querySelector('input')?.value==='Account Tester');
 const result=await page.evaluate(async packageId=>{
 const id=crypto.randomUUID(),accessCode='b'.repeat(64);
 const response=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json','x-quicksub-client':'web'},body:JSON.stringify({id,accessCode,packageId,name:'Account Tester',contact:'customer@example.test',note:'',expectedPrice:299})});return {status:response.status,id};
 },packageId);assert.equal(result.status,201);
 await env.db.query("update quicksub_orders set status='delivered',payment_status='verified' where id=$1",[result.id]);
 const subscription=(await env.db.query('select id from quicksub_subscriptions where order_id=$1',[result.id])).rows[0];
 await env.db.query("update quicksub_subscriptions set ends_at=now()+interval '2 days 23 hours' where id=$1",[subscription.id]);await env.db.query('select quicksub_sync_subscription_reminders($1)',[subscription.id]);
 const pending=await page.evaluate(async packageId=>{
  const id=crypto.randomUUID(),accessCode='c'.repeat(64);
  const response=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json','x-quicksub-client':'web'},body:JSON.stringify({id,accessCode,packageId,name:'Account Tester',contact:'customer@example.test',note:'',expectedPrice:299})});return {status:response.status,id};
 },packageId);assert.equal(pending.status,201);
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.innerText.includes('expires in 3 days'));
 await page.waitForSelector('button[aria-label^="Delete pending order"]');
 const alignment=await page.$eval('button[aria-label^="Delete pending order"]',button=>{const buttonBox=button.getBoundingClientRect(),card=button.closest('article')?.getBoundingClientRect();return {buttonRight:buttonBox.right,cardLeft:card?.left||0,cardWidth:card?.width||0};});
 assert.ok(alignment.buttonRight>alignment.cardLeft+alignment.cardWidth*.65,'Delete button should be aligned on the right side of its order card');
 page.once('dialog',dialog=>dialog.accept());await page.click('button[aria-label^="Delete pending order"]');
 await page.waitForFunction(()=>document.body.innerText.includes('Order removed from your history.'));
 const removedOrder=(await env.db.query('select status,customer_deleted_at from quicksub_orders where id=$1',[pending.id])).rows[0];
 assert.equal(removedOrder.status,'pending');assert.ok(removedOrder.customer_deleted_at);
 assert.equal(await page.evaluate(id=>document.body.innerText.includes(id),pending.id),false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await mkdir('deliverables/account-preview',{recursive:true});await page.screenshot({path:'deliverables/account-preview/mobile.png',fullPage:true});
 await page.click('a[href="/checkout?product=1"]');await page.waitForSelector('input[name="name"]');
 await click('Use my saved details');assert.equal(await page.$eval('[name="name"]',e=>e.value),'Account Tester');assert.equal(await page.$eval('[name="contact"]',e=>e.value),'customer@example.test');
 await page.goto(env.base+'/account',{waitUntil:'networkidle0'});await click('Sign out');await page.waitForFunction(()=>document.body.innerText.includes('Welcome back'));
 assert.equal(await page.evaluate(async()=> (await fetch('/api/account/orders')).status),401);
 await page.goto(env.base+'/admin',{waitUntil:'networkidle0'});
 await page.type('[name="email"]','owner@example.test');await page.type('[name="password"]','test-password');await click('Sign in to dashboard');
 await page.waitForFunction(()=>document.body.innerText.toLowerCase().includes('removed by customer'));
 assert.deepEqual(errors,[]);console.log('PASS: signup, persistent session/profile, owned order history, pending-order deletion, renewal reminder, saved checkout details, mobile layout, logout, and the admin removal marker.');
}finally{await browser?.close();await env.close();}
