import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {startTestServer} from './admin-test-server.mjs';
const env=await startTestServer();let browser;
try{
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1440,height:1000});await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(env.base)||r.url().startsWith('data:')?r.continue():r.abort('blockedbyclient'));
 await page.goto(env.base,{waitUntil:'networkidle0'});await page.waitForSelector('#products article');assert.equal(await page.$$eval('#products article',e=>e.length),21);
 await page.locator('#products input').fill('no-product-matches-this');await page.waitForFunction(()=>document.querySelectorAll('#products article').length===0);
 await page.click('[aria-label="Search products"]');await page.locator('input[placeholder="Search products, categories, badges…"]').fill('Netflix');await page.keyboard.press('Enter');await page.waitForFunction(()=>!!document.querySelector('#product-1'));assert.equal(await page.$eval('#products input',e=>e.value),'');console.log('PASS header search clears conflicting product text filter');
 const clickText=async(text)=>{await page.evaluate(t=>{const b=[...document.querySelectorAll('#products button')].find(b=>b.textContent.trim()===t);if(!b)throw Error('Button missing: '+t);b.click();},text);};
 await clickText('Sort: Default');await clickText('Price: Low to High');await page.waitForFunction(()=>document.querySelector('#products button')!==null);
 const prices=await page.$$eval('#products article',cards=>cards.map(c=>Number(c.textContent.match(/Starting from ৳([\d.]+)/)[1])));assert.deepEqual(prices,[...prices].sort((a,b)=>a-b));console.log('PASS numeric price sorting');
 await page.$eval('#product-1 [aria-label="Add to favorites"]',b=>b.click());await page.waitForSelector('#product-1 [aria-label="Remove from favorites"]');await page.reload({waitUntil:'networkidle0'});await page.waitForSelector('#product-1 [aria-label="Remove from favorites"]');console.log('PASS favorites persist across page reload');
 await page.$eval('#product-1 [aria-label="Add to compare"]',b=>b.click());await page.waitForSelector('#product-1 [aria-label="Already in compare"]');console.log('PASS compare selection state');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('quicksub:open-legal',{detail:'Privacy Policy'})));await page.waitForFunction(()=>document.body.textContent.includes('AI Support Chat'));console.log('PASS legal policy dialog');
 assert.deepEqual(errors,[]);console.log('PASS storefront regressions with external resources blocked and no runtime errors');
}finally{if(browser)await browser.close();await env.close();}
