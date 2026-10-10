import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { startTestServer } from './admin-test-server.mjs';

const env=await startTestServer();let browser;
try{
 await mkdir('deliverables/loyalty-language-preview',{recursive:true});
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,timeout:120000});
 const page=await browser.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewport({width:1280,height:900});await page.setRequestInterception(true);page.on('request',request=>request.url().startsWith(env.base)||request.url().startsWith('data:')?request.continue():request.abort('blockedbyclient'));
 const clickText=async text=>{await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===value),{},text);await page.evaluate(value=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===value).click(),text);};
 await page.goto(env.base+'/account',{waitUntil:'networkidle0'});await clickText('New here? Create an account');
 await page.type('[name="name"]','Language Rewards Tester');await page.type('[name="email"]','language-rewards@example.test');await page.type('[name="password"]','safe-password-123');await clickText('Create account');
 await page.waitForFunction(()=>document.body.innerText.includes('QuickSub Rewards')&&document.body.innerText.includes('Available points'));
 const code=await page.$eval('section[aria-labelledby="rewards-title"] strong.text-ink-900',element=>element.textContent.trim());assert.match(code,/^[A-F0-9]{8}$/);
 const customer=(await env.db.query("select user_id from quicksub_customers where contact='language-rewards@example.test'")).rows[0];
 await env.db.query("insert into quicksub_loyalty_transactions(customer_id,kind,points,description,event_key) values($1,'admin-adjustment',150,'Browser reward credit','browser-credit')",[customer.user_id]);
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.innerText.includes('150'));
 assert.equal(await page.$('select[aria-label="Choose language"]'),null);
 assert.equal(await page.evaluate(()=>document.documentElement.lang),'en-BD');
 assert.equal(await page.$eval('#quicksub-page-schema',element=>JSON.parse(element.textContent).inLanguage),'en-BD');
 assert.equal(await page.$('link[rel="alternate"][hreflang="bn-BD"]'),null);
 await page.screenshot({path:'deliverables/loyalty-language-preview/account-english-rewards.png',fullPage:true});
 await page.goto(env.base+'/checkout?product=1',{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.body.innerText.includes('Complete your order'));
 await page.waitForSelector('input[type="number"][max="150"]');await page.locator('input[type="number"]').fill('100');await page.waitForFunction(()=>document.body.innerText.includes('Points discount')&&[...document.querySelectorAll('strong')].some(element=>element.textContent?.replace(/\s+/g,' ').includes('BDT 25')));
 await page.screenshot({path:'deliverables/loyalty-language-preview/checkout-english-points.png',fullPage:true});
 assert.notEqual(await page.evaluate(()=>localStorage.getItem('quicksub-locale')),'bn-BD');assert.deepEqual(errors,[]);
 console.log('PASS English-only storefront, SEO, rewards balance/referral UI, and checkout point discount render correctly.');
}finally{await browser?.close();await env.close();}
