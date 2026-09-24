import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {mkdir} from 'node:fs/promises';
import {startTestServer,packageId} from './admin-test-server.mjs';
const env=await startTestServer();let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const errors=[];
 async function pageFor(context){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(env.base)||r.url().startsWith('data:')?r.continue():r.abort());return page;}
 const first=await browser.createBrowserContext(),second=await browser.createBrowserContext();
 const a=await pageFor(first),b=await pageFor(second);
 async function click(page,text){await page.waitForFunction(text=>[...document.querySelectorAll('button,a')].some(e=>e.textContent.trim()===text),{},text);await page.evaluate(text=>[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===text).click(),text);}
 await a.goto(env.base+'/account',{waitUntil:'networkidle0'});
 await click(a,'New here? Create an account');await a.type('[name="name"]','Cart Tester');await a.type('[name="email"]','cart-browser@example.test');await a.type('[name="password"]','cart-test-password');await click(a,'Create account');await a.waitForFunction(()=>document.body.innerText.includes('Signed in as'));
 await a.goto(env.base+'/checkout?product=1',{waitUntil:'networkidle0'});await a.waitForSelector('[name="name"]');await a.type('[name="name"]','Cart Tester');await a.type('[name="contact"]','cart-browser@example.test');await a.type('[name="note"]','Deliver to my saved account');await click(a,'Add to cart');await a.waitForFunction(()=>document.body.innerText.includes('Package saved to your account cart.'));await click(a,'View my cart');await a.waitForSelector('[aria-label="Cart items"]');
 assert.equal(new URL(a.url()).pathname,'/cart');await a.reload({waitUntil:'networkidle0'});await a.waitForSelector('[aria-label="Cart items"]');
 await b.goto(env.base+'/cart',{waitUntil:'networkidle0'});await b.waitForFunction(()=>document.body.innerText.includes('Sign in to open your cart'));await click(b,'Sign in to my cart');await b.waitForSelector('[name="email"]');await b.type('[name="email"]','cart-browser@example.test');await b.type('[name="password"]','cart-test-password');await click(b,'Sign in');await b.waitForSelector('[aria-label="Cart items"]');assert.equal(new URL(b.url()).pathname,'/cart');assert.ok((await b.$eval('main',e=>e.innerText)).includes('Deliver to my saved account'));
 await env.db.query('update quicksub_packages set price_bdt=349 where id=$1',[packageId]);await click(b,'Refresh cart');await b.waitForFunction(()=>document.body.innerText.includes('349.00'));
 await env.db.query('update quicksub_packages set active=false where id=$1',[packageId]);await click(b,'Refresh cart');await b.waitForFunction(()=>document.body.innerText.includes('Currently unavailable'));assert.equal(await b.$$eval('a',els=>els.some(e=>e.textContent.trim()==='Review & checkout')),false);
 await env.db.query('update quicksub_packages set active=true where id=$1',[packageId]);await click(b,'Refresh cart');await b.waitForFunction(()=>document.body.innerText.includes('Review & checkout'));
 await mkdir('deliverables/cart-preview',{recursive:true});
 await b.setViewport({width:1440,height:1000});await b.screenshot({path:'deliverables/cart-preview/desktop.png',fullPage:true});
 await b.setViewport({width:390,height:844});assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await b.screenshot({path:'deliverables/cart-preview/mobile.png',fullPage:true});
 await click(b,'Review & checkout');await b.waitForSelector('[name="name"]');
 const savedCheckoutUrl=b.url();
 await b.evaluate(async()=>{await fetch('/api/account/logout',{method:'POST',headers:{'content-type':'application/json','x-quicksub-client':'web'},body:'{}'});});
 await click(b,'My account');await b.waitForSelector('[name="email"]');
 assert.equal(new URL(b.url()).searchParams.get('next'),new URL(savedCheckoutUrl).pathname+new URL(savedCheckoutUrl).search);
 await b.type('[name="email"]','cart-browser@example.test');await b.type('[name="password"]','cart-test-password');await click(b,'Sign in');await b.waitForSelector('[name="name"]');
 assert.equal(b.url(),savedCheckoutUrl);
 assert.equal(await b.$eval('[name="name"]',e=>e.value),'Cart Tester');assert.equal(await b.$eval('[name="note"]',e=>e.value),'Deliver to my saved account');assert.equal(await b.$eval('[name="packageId"]',e=>e.value),packageId);
 await b.$eval('[name="note"]',e=>{e.value='';});await b.type('[name="note"]','Updated from device two');await click(b,'Save cart changes');await b.waitForFunction(()=>document.body.innerText.includes('Cart details updated.'));await click(b,'View my cart');await b.waitForFunction(()=>document.body.innerText.includes('Updated from device two'));
 await click(b,'Review & checkout');await b.waitForSelector('[name="name"]');await click(b,'Continue to payment · ৳349');await b.waitForFunction(()=>document.body.innerText.includes('Payment & receipt'));
 await b.goto(env.base+'/cart',{waitUntil:'networkidle0'});await b.waitForFunction(()=>document.body.innerText.includes('Your cart is empty'));
 await b.goto(env.base+'/account',{waitUntil:'networkidle0'});await b.waitForFunction(()=>document.body.innerText.includes('Order:'));assert.ok((await b.$eval('main',e=>e.innerText)).includes('349'));
 await a.goto(env.base+'/checkout?product=1',{waitUntil:'networkidle0'});await a.waitForSelector('[name="name"]');await click(a,'Add to cart');await a.waitForFunction(()=>document.body.innerText.includes('Package saved to your account cart.'));await click(a,'View my cart');await a.waitForSelector('[aria-label="Cart items"]');await click(a,'Remove');await a.waitForFunction(()=>document.body.innerText.includes('Your cart is empty'));await a.reload({waitUntil:'networkidle0'});await a.waitForFunction(()=>document.body.innerText.includes('Your cart is empty'));
 await a.goto(env.base+'/',{waitUntil:'networkidle0'});await a.waitForSelector('a[aria-label="My cart"]');await a.setViewport({width:320,height:800});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: add/update/remove; /cart direct reload and sign-in return; separate-browser restoration; live prices/unavailable packages; atomic checkout to order history; 390px cart and 320px storefront; no browser errors.');
}finally{await browser?.close();await env.close();}
