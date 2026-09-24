const express = require('express');
const { run, fail } = require('./http');
const { uuid, string, contact, validateBody } = require('./validation');
const schema = {
 name: value => string(value,120,0),
 contact: value => value === '' ? '' : contact(value),
 note: value => string(value,1000,0),
};
function createCartRouter({ db, customers, rate }) {
 const router = express.Router();
 router.use('/cart', run(async(req,res,next) => {
  req.customer = await customers.user(req);
  rate(req,'account-cart',60);
  next();
 }));
 router.get('/cart', run(async(req,res) => {
  const items = await db('rpc/quicksub_cart',{method:'POST',body:{p_user:req.customer.id}});
  res.json({items,limit:20});
 }));
 router.put('/cart/items/:packageId', run(async(req,res) => {
  if (!uuid.test(req.params.packageId)) throw fail(400,'Invalid package ID.');
  validateBody(req.body,schema);
  const b=req.body;
  await db('rpc/quicksub_save_cart_item',{method:'POST',body:{p_user:req.customer.id,p_package:req.params.packageId,p_name:string(b.name,120,0),p_contact:b.contact === '' ? '' : contact(b.contact),p_note:string(b.note,1000,0)}});
  res.json({ok:true});
 }));
 router.delete('/cart/items/:packageId', run(async(req,res) => {
  if (!uuid.test(req.params.packageId)) throw fail(400,'Invalid package ID.');
  await db(`quicksub_cart_items?user_id=eq.${req.customer.id}&package_id=eq.${req.params.packageId}`,{method:'DELETE'});
  res.json({ok:true});
 }));
 return router;
}
module.exports={createCartRouter};
