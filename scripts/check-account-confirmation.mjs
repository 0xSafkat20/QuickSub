import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {startTestServer,ownerId,staffId} from './admin-test-server.mjs';

const env=await startTestServer({emailConfirmation:true});
let browser;
try {
 const email='confirmation-browser@example.test',password='confirmation-password-123';
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const click=async text=>{await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===value),{},text);await page.evaluate(value=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===value).click(),text);};
 await page.setRequestInterception(true);
 page.on('request',request=>request.url().startsWith(env.base)||request.url().startsWith('data:')?request.continue():request.abort());
 await page.goto(env.base+'/account',{waitUntil:'networkidle0'});
 await click('New here? Create an account');
 await page.locator('[name="name"]').fill('Confirmation Browser');
 await page.locator('[name="email"]').fill(email);
 await page.locator('[name="password"]').fill(password);
 await click('Create account');
 await page.waitForFunction(()=>document.body.innerText.includes('Check your email for a confirmation link'));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Resend confirmation email')));

 await click('Already registered? Sign in');
 await page.locator('[name="email"]').fill(email);
 await page.locator('[name="password"]').fill(password);
 await click('Sign in');
 await page.waitForFunction(()=>document.body.innerText.includes('Confirm your email before signing in'));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Resend confirmation email')));
 await click('Resend confirmation email');
 await page.waitForFunction(()=>document.body.innerText.includes('a new email has been sent'));

 const rows=await env.db.query('select id from auth.users where id not in ($1,$2)',[ownerId,staffId]);
 const token=rows.rows[0].id;
 await page.goto(env.base+'/account#access_token='+token+'&refresh_token='+token+'&type=signup',{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>document.body.innerText.includes('Signed in as'));
 assert.equal(page.url(),env.base+'/account');
 assert.match(await page.locator('body').innerText(),/Email confirmed\. You are now signed in\./);
 assert.deepEqual(errors,[]);
 console.log('PASS: pending-confirmation login guidance, safe resend, callback sign-in, URL cleanup and two-hour session.');
} finally {await browser?.close();await env.close();}