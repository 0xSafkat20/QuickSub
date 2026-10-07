import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {mkdir} from 'node:fs/promises';
import {startTestServer} from './admin-test-server.mjs';
const env=await startTestServer({demoCheckout:true});let browser;
try {
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith(env.base)||r.url().startsWith('data:')?r.continue():r.abort());
 await page.evaluateOnNewDocument(()=>localStorage.setItem('quicksub-cookie-consent','accepted'));
 await mkdir('deliverables/responsive-preview',{recursive:true});
 const visit=async route=>{await page.goto(env.base+route,{waitUntil:'networkidle0'});};
 const check=async label=>{const measurements=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,fields:[...document.querySelectorAll('input,select,textarea')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&getComputedStyle(el).visibility!=='hidden'&&r.top>=0&&r.top<innerHeight&&!el.closest('[inert]');}).filter(el=>{const r=el.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(el=>el.getAttribute('aria-label')||el.name||el.tagName)}));assert.ok(measurements.scroll<=measurements.width+1,label+': page overflows '+JSON.stringify(measurements));assert.deepEqual(measurements.fields,[],label+': fields outside viewport');};
 for(const [width,height] of [[320,640],[390,844],[768,1024],[1024,768],[1280,800],[1440,900],[2560,1440],[844,390]]){
  await page.setViewport({width,height});
  for(const route of ['/','/checkout?product=3','/account','/cart','/track','/admin','/?payment=return']){
   await visit(route);await check(`${route} ${width}x${height}`);
   if(route==='/'){
    const overlap=await page.$eval('header nav',nav=>{const children=[...nav.children].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0);return children.some((a,i)=>children.slice(i+1).some(b=>a.right>b.left+1&&b.right>a.left+1));});assert.equal(overlap,false,`Header overlaps at ${width}`);
    if(width<1280){await page.click('button[aria-label="Open menu"]');await page.waitForSelector('#mobile-navigation');const fits=await page.$eval('#mobile-navigation',el=>el.getBoundingClientRect().bottom<=innerHeight+1);assert.ok(fits,`Menu too tall at ${width}x${height}`);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#mobile-navigation'));}
   }
   if([320,768,1440].includes(width)&&['/','/checkout?product=3','/account'].includes(route))await page.screenshot({path:`deliverables/responsive-preview/${route==='/'?'store':route.startsWith('/checkout')?'checkout':'account'}-${width}.png`});
  }
  console.log(`PASS routes and navigation: ${width}x${height}`);
 }
 await page.setViewport({width:320,height:640});await visit('/');
 await page.evaluate(()=>window.scrollTo(0,900));
 await page.waitForFunction(()=>document.querySelector('header').className.includes('backdrop-blur'));
 await page.click('[aria-label="Open menu"]');
 await page.click('#mobile-navigation button[aria-label="Open order tracking"]');
 await page.waitForSelector('[aria-label="Track your order"]');
 const trackingFits=await page.$eval('[aria-label="Track your order"]',el=>{const r=el.parentElement.getBoundingClientRect();return Math.abs(r.top)<1&&Math.abs(r.height-innerHeight)<1;});assert.ok(trackingFits,'Tracking backdrop must cover the viewport below the scrolled header');
 await check('Tracking dialog');await page.click('[aria-label="Close tracking"]');await page.click('[aria-label="Close menu"]');
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.click('[aria-label="Search"]');await page.waitForSelector('[placeholder="Search products, categories, badges…"]');await check('Search modal');await page.click('[aria-label="Close search"]');
 await page.click('[aria-label="Open chat"]');await page.waitForSelector('[aria-label="Close chat"]');await check('Chat open');const chat=await page.$eval('[aria-label="Message QuickSub support"]',el=>({width:el.getBoundingClientRect().width,font:parseFloat(getComputedStyle(el).fontSize)}));assert.ok(chat.width>80&&chat.font>=16);await page.screenshot({path:'deliverables/responsive-preview/chat-320.png'});await page.click('[aria-label="Close chat"]');
 await page.$eval('#product-3 .cursor-pointer',el=>el.click());await page.waitForSelector('[aria-label="Close"]');await check('Product details');await page.screenshot({path:'deliverables/responsive-preview/product-320.png'});await page.click('[aria-label="Close"]');
 // An arbitrarily long FAQ answer must reflow instead of being cut off.
 await page.evaluate(()=>{const section=document.querySelector('#faq');section.scrollIntoView();const button=section.querySelector('button');if(button.getAttribute('aria-expanded')!=='true')button.click();});
 await page.waitForFunction(()=>document.querySelector('#faq button[aria-expanded="true"]'));
 await page.evaluate(()=>{const button=document.querySelector('#faq button[aria-expanded="true"]');const region=button.nextElementSibling;const p=region.querySelector('p');p.textContent='Long answer for narrow screens. '.repeat(100);return region;});
 await page.waitForFunction(()=>{const r=document.querySelector('#faq button[aria-expanded="true"]').nextElementSibling;return r.scrollHeight<=r.clientHeight+1;});
 // Authenticated account dashboard and every admin section must also reflow.
 await visit('/account');await page.evaluate(async()=>fetch('/api/account/signup',{method:'POST',headers:{'content-type':'application/json','x-quicksub-client':'web'},body:JSON.stringify({name:'Responsive Customer',email:'responsive@example.test',password:'test-password-123'})}));
 for(const width of [320,768,1440]){await page.setViewport({width,height:900});await visit('/account');await page.waitForSelector('section[aria-label="Order history"]');await check('Account dashboard '+width);}
 await page.evaluate(async()=>fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json','x-quicksub-client':'web'},body:JSON.stringify({email:'owner@example.test',password:'test-password'})}));
 for(const width of [320,768,1440]){await page.setViewport({width,height:900});await visit('/admin');await page.waitForSelector('.qs-admin-sidebar');if(width>700){const footerFits=await page.$eval('.qs-admin-sidebar-bottom',el=>{const footer=el.getBoundingClientRect();const sidebar=el.closest('.qs-admin-sidebar').getBoundingClientRect();const signOut=[...el.querySelectorAll('button')].find(button=>button.textContent.trim()==='Sign out')?.getBoundingClientRect();return Boolean(signOut)&&footer.top>=sidebar.top-1&&footer.bottom<=sidebar.bottom+1&&signOut.top>=sidebar.top-1&&signOut.bottom<=sidebar.bottom+1;});assert.ok(footerFits,`Admin Sign out is outside the visible sidebar at ${width}`);}const names=await page.$$eval('.qs-admin-sidebar nav button:not(.qs-admin-nav-toggle)',els=>els.map(e=>(e.getAttribute('aria-label')||'').split(',')[0]));for(const name of names){await page.evaluate(n=>[...document.querySelectorAll('.qs-admin-sidebar nav button:not(.qs-admin-nav-toggle)')].find(e=>(e.getAttribute('aria-label')||'').split(',')[0]===n)?.click(),name);await check(`Admin ${name} ${width}`);}await page.screenshot({path:`deliverables/responsive-preview/admin-${width}.png`});
 await page.evaluate(()=>[...document.querySelectorAll('.qs-admin-sidebar nav button')].find(e=>e.textContent.trim()==='Products').click());
 await page.waitForSelector('td button');await page.evaluate(()=>[...document.querySelectorAll('td button')].find(e=>e.textContent.trim()==='Edit').click());
 await page.waitForSelector('.qs-admin-editor');await check('Product editor '+width);
 const editorFits=await page.$eval('.qs-admin-editor',el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.height<=innerHeight+1;});assert.ok(editorFits,'Editor outside viewport '+width);
 await page.click('[aria-label="Close editor"]');}
 assert.deepEqual(errors,[]);console.log('PASS search, chat, product dialog, unlimited FAQ height, account dashboard and admin sections.');
} finally {await browser?.close();await env.close();}
