import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {mkdir,readdir,readFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {startTestServer,packageId} from './admin-test-server.mjs';
const env=await startTestServer({receiptSimulation:true});let browser;
const dir=path.resolve('output/pdf');await mkdir(dir,{recursive:true});
try{
 await env.db.query("update quicksub_packages set details='1 month. Access: 1 device at a time; phone, tablet, computer or TV.' where id=$1",[packageId]);
 await env.db.query("insert into quicksub_packages(id,product_id,name,price_bdt,details) values('20000000-0000-4000-8000-000000000003','3','325 UC',499,'One-time PUBG top-up. Delivered to the specified player ID.')");
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,protocolTimeout:120000});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(60000);
 const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 await page.setViewport({width:1100,height:900});
 const click=async(text)=>{await page.waitForFunction(t=>[...document.querySelectorAll('button')].some(e=>e.textContent.trim().startsWith(t)),{},text);await page.evaluate(t=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith(t)).click(),text);};
 for(const [product,label] of [['1','subscription'],['3','game']]){
  console.log('Checking '+label+' receipt...');
  await page.goto(env.base+'/checkout?product='+product,{waitUntil:'networkidle0'});
  await page.waitForSelector('[name="name"]');await page.type('[name="name"]','Demo Customer');await page.type('[name="contact"]','demo@example.test');
  if(product==='3')await page.type('[name="gameAccount"]','Player98765 / Asia');
  await click('Continue to payment');await page.waitForFunction(()=>document.body.innerText.includes('Payment & receipt'));
  assert.ok(!(await page.$eval('main',e=>e.innerText)).includes('Private access code:'));
  if(product==='1')assert.ok((await page.$eval('main',e=>e.innerText)).includes('Pending payment confirmation'));
  await page.waitForSelector('[name="phone"]');await page.type('[name="phone"]','01712345678');await page.click('input[type="checkbox"]');await click('Simulate online payment');
  await page.waitForFunction(()=>document.body.innerText.includes('Payment: verified'));
  console.log(label+' payment confirmed');
  const before=new Set(await readdir(dir));await click('Download order receipt');
  let file;
  for(let n=0;n<100;n++){file=(await readdir(dir)).find(f=>f.endsWith('.pdf')&&!before.has(f));if(file)break;await new Promise(r=>setTimeout(r,200));}
  assert.ok(file,'PDF download completed');assert.equal((await readFile(path.join(dir,file))).subarray(0,5).toString(),'%PDF-');
  console.log(label+' PDF downloaded');
  await rename(path.join(dir,file),path.join(dir,label+'-receipt.pdf'));
  await page.screenshot({path:path.join(dir,label+'-preview.png'),fullPage:true,timeout:120000});
  await page.setViewport({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewport({width:1100,height:900});
 }
 assert.deepEqual(errors,[]);console.log('PASS: subscription and game checkout, simulated online payment, PDF downloads, no visible tracking secrets, responsive receipt.');
}finally{await browser?.close();await env.close();}
