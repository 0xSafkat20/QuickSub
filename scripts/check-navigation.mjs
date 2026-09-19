import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {startTestServer} from './admin-test-server.mjs';
const env=await startTestServer({demoCheckout:true});let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(env.base)||r.url().startsWith('data:')?r.continue():r.abort());
 await page.evaluateOnNewDocument(()=>localStorage.setItem('quicksub-cookie-consent','accepted'));
 await page.goto(env.base+'/checkout?product=3',{waitUntil:'networkidle0'});const time=await page.evaluate(()=>performance.timeOrigin);
 const click=async text=>{await page.waitForFunction(t=>[...document.querySelectorAll('button,a')].some(e=>e.textContent.trim()===t),{},text);await page.evaluate(t=>[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===t).click(),text);};
 await page.waitForSelector('form select');await page.select('form select','demo-3-2');await page.type('[name="name"]','Navigation Customer');await page.type('[name="contact"]','buyer@example.test');await page.type('[name="note"]','Player 123');
 await click('Sign in or create an account');await page.waitForSelector('input[name="email"]');assert.ok(new URL(page.url()).searchParams.get('next').includes('product=3'));
 await click('New here? Create an account');await page.type('[name="name"]','Navigation Customer');await page.type('[name="email"]','navigation@example.test');await page.type('[name="password"]','test-password-123');await click('Create account');
 await page.waitForSelector('form select');assert.equal(await page.$eval('form select',e=>e.value),'demo-3-2');assert.equal(await page.$eval('[name="name"]',e=>e.value),'Navigation Customer');assert.equal(await page.$eval('[name="note"]',e=>e.value),'Player 123');assert.equal(await page.evaluate(()=>performance.timeOrigin),time);
 await click('Track order');await page.waitForSelector('[aria-label="Track your order"]');assert.equal(new URL(page.url()).pathname,'/track');
 await page.goBack();await page.waitForSelector('form select');assert.equal(await page.$eval('form select',e=>e.value),'demo-3-2');
 await click('Browse products');await page.waitForSelector('#products');await page.waitForFunction(()=>Math.abs(document.querySelector('#products').getBoundingClientRect().top)<150);assert.equal(await page.evaluate(()=>performance.timeOrigin),time);
 await click('Order Status');await page.waitForSelector('[aria-label="Track your order"]');assert.equal(new URL(page.url()).pathname,'/track');
 const historyLength=await page.evaluate(()=>history.length);await click('Track order');assert.equal(await page.evaluate(()=>history.length),historyLength);
 await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('[aria-label="Track your order"]');
 await page.goto(env.base+'/account?next=https%3A%2F%2Fevil.example%2Fcheckout',{waitUntil:'networkidle0'});assert.equal(await page.$$eval('a',els=>els.some(e=>e.href.includes('evil.example'))),false);
 assert.deepEqual(errors,[]);console.log('PASS checkout → account → checkout preserves package/details; shared tracking links; back navigation; product section scrolling; direct tracking reload; external return URL rejected.');
}finally{await browser?.close();await env.close();}
