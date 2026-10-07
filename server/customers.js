const { SESSION_DURATION_MS, createSessionManager, sessionHeader } = require("./sessions");
const { validateBody, authSchemas } = require("./validation");
const { randomBytes, createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail = (status,message) => Object.assign(new Error(message),{status});
function installCustomers({router,run,db,remote,rate,string,contact,now}) {
 const sessions = createSessionManager({ table: "quicksub_customer_sessions", db, remote, now });
 const cookie = req => (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('qs_customer='))?.slice(12);
 const options = req => ({httpOnly:true,secure:req.secure || process.env.NODE_ENV==='production',sameSite:'lax',path:'/api'});
 async function user(req,required=true) {
  const id=cookie(req);
  if (!id && !required) return null;
  try {
   const active = await sessions.get(id);
   sessionHeader(req.res, 'customer', active.expiresAt);
   return active.user;
  } catch (err) {
   if (err.status === 401) req.res.clearCookie('qs_customer', options(req));
   throw err;
  }
 }

 async function session(req,res,auth) {
  if (!auth.access_token || !auth.user?.id) return false;
  const id=randomBytes(32).toString('hex');
  const record=await sessions.create(id,auth);
  res.cookie('qs_customer',id,{...options(req),maxAge:SESSION_DURATION_MS});
  sessionHeader(res,'customer',record.expires_at);
  return true;
 }
 const email = value => { const v=string(value,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw fail(400,'Enter a valid email address.');return v; };
 async function optionalTableRows(table,path) {
  try {return await db(path);}
  catch(error) {
   try {
    const schema=await remote('/rest/v1/',{headers:{Accept:'application/openapi+json'}});
    if(!schema?.definitions?.[table])return [];
   } catch {}
   throw error;
  }
 }
 async function saveCustomer({userId,name,customerContact,reminders,locale}) {
  const modern={p_user:userId,p_name:name,p_contact:customerContact,p_reminders:reminders,p_locale:locale||null};
  try {return await db('rpc/quicksub_save_customer',{method:'POST',body:modern});}
  catch(error) {
   const provider=String(error.providerCode||'')+' '+String(error.providerMessage||'');
   if(!/PGRST202|quicksub_save_customer|p_locale|schema cache/i.test(provider))throw error;
   return db('rpc/quicksub_save_customer',{method:'POST',body:{p_user:userId,p_name:name,p_contact:customerContact,p_reminders:reminders}});
  }
 }
 async function customerProfile(userId) {
  try {
   const [profile]=await db(`quicksub_customers?user_id=eq.${userId}&select=name,contact,renewal_reminders,preferred_locale,referral_code`);
   return profile||null;
  } catch(error) {
   const provider=String(error.providerCode||'')+' '+String(error.providerMessage||'');
   if(!/PGRST204|preferred_locale|referral_code|schema cache/i.test(provider))throw error;
   const [profile]=await db(`quicksub_customers?user_id=eq.${userId}&select=name,contact,renewal_reminders`);
   return profile?{...profile,preferred_locale:'en-BD',referral_code:null}:null;
  }
 }
 router.post('/account/forgot-password',run(async(req,res)=>{
  rate(req,'password-recovery',3);
  validateBody(req.body, authSchemas.forgotPassword);
  const address=email(req.body?.email);
  // The same trusted origin enforced by the router; never accept redirect URLs from the body.
  const origin=process.env.PUBLIC_ORIGIN || req.get('origin');
  const redirect=origin+'/reset-password';
  try { await remote('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{email:address}}); }
  catch(err) {
   if(err.providerStatus===429)throw fail(429,'Please wait a few minutes before requesting another reset email.');
   if(![400,404,422].includes(err.providerStatus))throw fail(503,'Reset emails are temporarily unavailable. Please try again later.');
  }
  res.json({message:'If an account exists for that email, you will receive a password reset link. Check your inbox and spam folder.'});
 }));
 router.post('/account/reset-password',run(async(req,res)=>{
  rate(req,'password-reset',6);
  validateBody(req.body, authSchemas.resetPassword);
  const b=req.body||{};const password=string(b.password,128,10,false);
  if(password!==b.confirmPassword)throw fail(400,'The passwords do not match.');
  if(Boolean(b.tokenHash)===Boolean(b.accessToken))throw fail(400,'This reset link is invalid. Request a new link.');
  let auth,user;
  try {
   if(b.tokenHash) {
    auth=await remote('/auth/v1/verify',{method:'POST',body:{token_hash:string(b.tokenHash,512,20),type:'recovery'}});
    user=auth.user;
   } else {
    const accessToken=string(b.accessToken,4096,20,false);
    user=await remote('/auth/v1/user',{token:accessToken});
    auth={access_token:accessToken,user};
   }
  }
  catch {throw fail(400,'This reset link is invalid, expired, or already used. Request a new link.');}
  if(!auth.access_token || !uuid.test(user?.id))throw fail(400,'This reset link is invalid. Request a new link.');
  try {await remote('/auth/v1/user',{method:'PUT',token:auth.access_token,body:{password}});}
  catch {throw fail(400,'The password could not be updated. Use a different strong password and request a new reset link.');}
  // Invalidate every QuickSub customer and administrator session on every device.
  try {
   await db('quicksub_customer_sessions?user_id=eq.'+user.id,{method:'DELETE'});
   await db('quicksub_admin_sessions?user_id=eq.'+user.id,{method:'DELETE'});
   await remote('/auth/v1/logout?scope=global',{method:'POST',token:auth.access_token});
  } catch {throw fail(503,'Your password changed, but session cleanup is incomplete. Contact support before continuing.');}
  res.clearCookie('qs_customer',options(req));
  res.json({message:'Your password has been changed. Sign in with your new password.'});
 }));
 router.post('/account/resend-confirmation',run(async(req,res)=>{
  rate(req,'confirmation-email',3);
  validateBody(req.body, authSchemas.forgotPassword);
  const address=email(req.body?.email);
  const origin=process.env.PUBLIC_ORIGIN || req.get('origin');
  const redirect=origin+'/account';
  try {await remote('/auth/v1/resend?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{type:'signup',email:address}});}
  catch(err) {
   if(err.providerStatus===429)throw fail(429,'Please wait a few minutes before requesting another confirmation email.');
   if(![400,404,422].includes(err.providerStatus))throw fail(503,'Confirmation emails are temporarily unavailable. Please try again later.');
  }
  res.json({message:'If this account is waiting for confirmation, a new email has been sent. Check your inbox and spam folder.'});
 }));
 router.post('/account/signup',run(async(req,res)=>{
  rate(req,'customer-signup',4);
  validateBody(req.body, authSchemas.signup);
  // Check the schema before creating an Auth user.
  await db('quicksub_customers?select=user_id&limit=1');
  const b=req.body||{};const name=string(b.name,120);const locale=['en-BD','bn-BD'].includes(b.locale)?b.locale:'en-BD';
  if(b.referralCode){const referralCode=String(b.referralCode).trim().toUpperCase();const matches=await db(`quicksub_customers?referral_code=eq.${encodeURIComponent(referralCode)}&select=user_id&limit=1`);if(!matches.length)throw fail(400,'Referral code not found. Check the code or continue without it.');b.referralCode=referralCode;}
  const origin=process.env.PUBLIC_ORIGIN || req.get('origin');
  const redirect=origin+'/account';
  const auth=await remote('/auth/v1/signup?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{email:email(b.email),password:string(b.password,128,10,false),data:{name,locale,referralCode:b.referralCode||''}}});
  const signedIn=await session(req,res,auth);
  if(signedIn){await saveCustomer({userId:auth.user.id,name,customerContact:auth.user.email,reminders:true,locale});if(b.referralCode)await db('rpc/quicksub_attach_referral',{method:'POST',body:{p_user:auth.user.id,p_code:b.referralCode}});}
  res.json({signedIn,message:signedIn?'Account created.':'Check your email for a confirmation link, then sign in. If you already have an account, sign in instead.'});
 }));
 router.post('/account/confirm',run(async(req,res)=>{
  rate(req,'customer-confirmation',6);
  validateBody(req.body, authSchemas.confirmSignup);
  const b=req.body||{};
  let confirmed;
  try {confirmed=await remote('/auth/v1/user',{token:string(b.accessToken,4096,20,false)});}
  catch {throw fail(400,'This confirmation link is invalid or expired. Request a new confirmation email.');}
  if(!uuid.test(confirmed?.id)||!confirmed.email)throw fail(400,'This confirmation link is invalid. Request a new confirmation email.');
  const auth={user:confirmed,access_token:b.accessToken,refresh_token:b.refreshToken,expires_in:3600};
  const [profile]=await db('quicksub_customers?user_id=eq.'+confirmed.id+'&select=user_id');
  if(!profile){await saveCustomer({userId:confirmed.id,name:String(confirmed.user_metadata?.name||'').slice(0,120),customerContact:confirmed.email,reminders:true,locale:['en-BD','bn-BD'].includes(confirmed.user_metadata?.locale)?confirmed.user_metadata.locale:null});if(confirmed.user_metadata?.referralCode)await db('rpc/quicksub_attach_referral',{method:'POST',body:{p_user:confirmed.id,p_code:String(confirmed.user_metadata.referralCode).slice(0,32)}});}
  if(!await session(req,res,auth))throw fail(401,'Confirmation succeeded, but sign-in could not be completed.');
  res.json({message:'Email confirmed. You are now signed in.'});
 }));
 router.post('/account/login',run(async(req,res)=>{
  rate(req,'customer-login',6);
  validateBody(req.body, authSchemas.login);
  const b=req.body||{};
  let auth;
  try {auth=await remote('/auth/v1/token?grant_type=password',{method:'POST',body:{email:email(b.email),password:string(b.password,128,1,false)}});}
  catch(err) {
   if(err.providerCode==='email_not_confirmed'||/email not confirmed/i.test(err.providerMessage||''))throw fail(403,'Confirm your email before signing in. You can request a new confirmation email below.');
   throw err;
  }
  const [profile]=await db(`quicksub_customers?user_id=eq.${auth.user.id}&select=user_id`);
  if(!profile)await saveCustomer({userId:auth.user.id,name:String(auth.user.user_metadata?.name||'').slice(0,120),customerContact:auth.user.email,reminders:true,locale:null});
  if(!await session(req,res,auth))throw fail(401,'Sign-in failed.');
  res.json({ok:true});
 }));
 router.post('/account/logout',run(async(req,res)=>{
  const id=cookie(req);
  await sessions.remove(id);
  res.clearCookie('qs_customer',options(req));res.json({ok:true});
 }));
 router.get('/account/session',run(async(req,res)=>{
  const person=await user(req,false);
  if(!person)return res.json({user:null,profile:null});
  const profile=await customerProfile(person.id);
  res.json({user:{id:person.id,email:person.email},profile:profile||null});
 }));
 router.post('/account/profile',run(async(req,res)=>{
  rate(req,'customer-profile',20);const person=await user(req);const b=req.body||{};
  if(typeof b.renewal_reminders!=='boolean')throw fail(400,'Choose your reminder preference.');
  if(b.preferred_locale!==undefined&&!['en-BD','bn-BD'].includes(b.preferred_locale))throw fail(400,'Choose a supported language.');
  const profile=await saveCustomer({userId:person.id,name:string(b.name,120),customerContact:contact(b.contact),reminders:b.renewal_reminders,locale:b.preferred_locale||null});
  res.json({profile});
 }));
 router.get('/account/orders',run(async(req,res)=>{
  rate(req,'customer-orders',40);const person=await user(req);
  const offset=Number(req.query.offset||0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw fail(400,'Invalid page.');
  const orders=await db(`quicksub_orders?customer_id=eq.${person.id}&customer_deleted_at=is.null&select=id,package_id,product_name,package_name,amount_bdt,status,payment_status,delivery_note,created_at,expires_at&order=created_at.desc,id.desc&limit=41&offset=${offset}`);
  const markers=orders.length?await db(`quicksub_content?id=in.(${orders.map(o=>'customer-order-removed-'+o.id).join(',')})&select=id,data`):[];
  const removed=new Set(markers.filter(marker=>marker.data?.kind==='customer-order-removal'&&marker.data?.customer_id===person.id).map(marker=>marker.data.order_id));
  const visible=orders.filter(order=>!removed.has(order.id));
  const packages=visible.length?await db(`quicksub_packages?id=in.(${[...new Set(visible.map(o=>o.package_id))].join(',')})&select=id,product_id`):[];
  res.json({orders:visible.slice(0,20).map(o=>({...o,product_id:packages.find(p=>p.id===o.package_id)?.product_id})),hasMore:visible.length>20});
 }));
 router.delete('/account/orders/:id',run(async(req,res)=>{
  rate(req,'customer-order-delete',12);const person=await user(req);const id=req.params.id;
  if(!uuid.test(id))throw fail(400,'Invalid order.');
  try {
   await db('rpc/quicksub_delete_pending_order',{method:'POST',body:{p_user:person.id,p_id:id}});
  } catch (rpcError) {
   // Compatibility path for deployments where the newest database migration has
   // not been applied yet. Every authorization and state check remains server-side.
   let order;
   try {[order]=await db(`quicksub_orders?id=eq.${id}&customer_id=eq.${person.id}&select=id,status,payment_status,customer_deleted_at`);}
   catch {throw fail(503,'Order history removal is temporarily unavailable. Please try again later.');}
   if(!order||order.customer_deleted_at)throw fail(404,'Order not found in your account.');
   if(order.status!=='pending'||order.payment_status!=='unpaid')throw fail(409,'Only pending, unpaid orders can be removed from your history.');
   const payments=await optionalTableRows('quicksub_payments',`quicksub_payments?order_id=eq.${id}&select=id&limit=1`);
   if(payments.length)throw fail(409,'This order has payment activity and cannot be removed.');
   const subscriptions=await optionalTableRows('quicksub_subscriptions',`quicksub_subscriptions?order_id=eq.${id}&select=id&limit=1`);   if(subscriptions.length)throw fail(409,'This order has subscription activity and cannot be removed.');
   const deletedAt=new Date(now()).toISOString();let compatibilityMarker=false;
   try {await db(`quicksub_orders?id=eq.${id}&customer_id=eq.${person.id}&status=eq.pending&payment_status=eq.unpaid&customer_deleted_at=is.null`,{method:'PATCH',body:{customer_deleted_at:deletedAt,updated_at:deletedAt}});}
   catch {
    const markerId='customer-order-removed-'+id;const marker={kind:'customer-order-removal',order_id:id,customer_id:person.id,removed_at:deletedAt};
    try {await db('quicksub_content',{method:'POST',body:{id:markerId,data:marker,updated_at:deletedAt}});}
    catch {await db(`quicksub_content?id=eq.${markerId}`,{method:'PATCH',body:{data:marker,updated_at:deletedAt}});}
    compatibilityMarker=true;
   }
   if(!compatibilityMarker){const remaining=await db(`quicksub_orders?id=eq.${id}&customer_id=eq.${person.id}&customer_deleted_at=is.null&select=id&limit=1`);if(remaining.length)throw fail(409,'Order changed. Refresh and try again.');}
  }
  res.json({ok:true});
 }));
 router.post('/account/claim',run(async(req,res)=>{
  rate(req,'customer-claim',6);const person=await user(req);const b=req.body||{};
  if(!uuid.test(b.id)||!/^[a-f0-9]{64}$/.test(b.accessCode||''))throw fail(400,'Enter the order ID and private access code from your receipt.');
  await db('rpc/quicksub_claim_order',{method:'POST',body:{p_user:person.id,p_id:b.id,p_hash:hash(b.accessCode)}});
  res.json({ok:true});
 }));
 router.get('/admin/orders/:id/subscription',run(async(req,res)=>{
  if(!uuid.test(req.params.id))throw fail(400,'Invalid order.');
  const [order]=await db(`quicksub_orders?id=eq.${req.params.id}&select=expires_at`);
  if(!order)throw fail(404,'Order not found.');res.json(order);
 }));
 router.post('/admin/orders/:id/subscription',run(async(req,res)=>{
  const expires=req.body?.expires_at;
  if(!uuid.test(req.params.id)||(expires!==null&&(typeof expires!=='string'||!Number.isFinite(Date.parse(expires)))))throw fail(400,'Enter a valid expiry date.');
  await db('rpc/quicksub_set_expiry',{method:'POST',body:{p_actor:req.admin.id,p_id:req.params.id,p_expires:expires===null?null:new Date(expires).toISOString()}});
  res.json({ok:true});
 }));
 return {user};
}
module.exports={installCustomers};
