import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import { startTestServer, packageId } from './admin-test-server.mjs';
const env=await startTestServer();let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:390,height:844});await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(env.base)||r.url().startsWith('data:')?r.continue():r.abort());
 const click=async(text,selector='button')=>{await page.waitForFunction((t,s)=>[...document.querySelectorAll(s)].some(e=>e.textContent.trim()===t),{},text,selector);await page.evaluate((t,s)=>[...document.querySelectorAll(s)].find(e=>e.textContent.trim()===t).click(),text,selector);};
 console.log('STEP account');await page.goto(env.base+'/account',{waitUntil:'networkidle0'});await click('New here? Create an account');await page.type('[name=name]','Subscription Tester');await page.type('[name=email]','subscription-ui@example.test');await page.type('[name=password]','subscription-password-123');await click('Create account');await page.waitForFunction(()=>document.body.innerText.includes('Signed in as'));
 console.log('STEP signed in');const order=await page.evaluate(async packageId=>{const id=crypto.randomUUID(),accessCode='c'.repeat(64);const r=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json','x-quicksub-client':'web'},body:JSON.stringify({id,accessCode,packageId,expectedPrice:299,name:'Subscription Tester',contact:'subscription-ui@example.test',email:'subscription-ui@example.test',note:''})});return {status:r.status,id};},packageId);assert.equal(order.status,201);
 console.log('STEP order',order);await env.db.query("update quicksub_orders set payment_status='verified',status='delivered' where id=$1",[order.id]);
 console.log('STEP paid');await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.innerText.includes('Netflix Premium')&&document.body.innerText.includes('My subscriptions'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const subscription=await env.db.query('select id from quicksub_subscriptions where order_id=$1',[order.id]);const id=subscription.rows[0].id;
 console.log('STEP dashboard');await mkdir('deliverables/subscriptions-preview',{recursive:true});await page.screenshot({path:'deliverables/subscriptions-preview/customer-mobile.png',fullPage:true});
 console.log('STEP screenshot',id);await page.goto(env.base+'/subscriptions/'+id,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.innerText.toLowerCase().includes('subscription details')&&document.body.innerText.toLowerCase().includes('payment confirmed'));
 console.log('STEP detail');await click('Renew subscription');await page.waitForFunction(()=>location.pathname==='/checkout'&&new URLSearchParams(location.search).has('renewal'));await page.waitForFunction(()=>document.body.innerText.includes('Subscription renewal'));
 assert.equal(await page.$eval('select[name=packageId]',e=>e.value),packageId);
 console.log('STEP checkout');await page.goto(env.base+'/admin',{waitUntil:'networkidle0'});await page.type('[name=email]','owner@example.test');await page.type('[name=password]','test-password');await click('Sign in to dashboard');await page.waitForSelector('.qs-admin-metrics');await click('Subscriptions','nav button');await page.waitForFunction(()=>document.body.innerText.includes('Manage access, devices, expiry and renewal status.'));await click('Manage');await page.waitForSelector('.qs-admin-editor');assert.equal(await page.$eval('[name=device_limit]',e=>e.value),'1');await page.screenshot({path:'deliverables/subscriptions-preview/admin-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: subscription dashboard, detail route, renewal checkout, mobile layout and admin controls.');
}finally{await browser?.close();await env.close();}
