import type { TrackedOrder } from '../components/sections/CustomerOrder';

export const receiptDate = (value?: string | null) => value
  ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }) + ' (BDT)'
  : 'Pending payment confirmation';

// Render browser fonts to retain multilingual customer names in the PDF.
// Only explicitly allowlisted receipt fields are included, never tracking secrets.
export async function downloadReceipt(order: TrackedOrder) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;padding:48px;background:#fff;color:#14213d;font:16px Arial,sans-serif;box-sizing:border-box;line-height:1.55';
  const add = (tag: string, text: string, style = '') => {
    const el = document.createElement(tag); el.textContent = text; el.style.cssText = style; root.append(el); return el;
  };
  add('div', 'QuickSub', 'font-size:32px;font-weight:800;color:#2458e8');
  add('h1', 'Order receipt', 'font-size:26px;margin:8px 0 4px');
  add('p', 'Order ' + order.id, 'font-size:13px;color:#52627a;margin:0 0 24px;overflow-wrap:anywhere');
  const section = (name: string) => add('h2', name, 'font-size:16px;color:#2458e8;border-top:1px solid #dbe5f4;padding-top:18px;margin:22px 0 10px');
  const row = (label: string, value?: string | null) => {
    const el=add('div','', 'display:grid;grid-template-columns:190px 1fr;gap:18px;padding:6px 0;overflow-wrap:anywhere;white-space:pre-wrap');
    const key=document.createElement('strong');key.textContent=label;
    const val=document.createElement('span');val.textContent=value || 'Not provided';el.append(key,val);
  };
  section('Customer'); row('Name',order.customer_name);row('Email',order.receipt_email || (order.contact?.includes('@')?order.contact:''));
  if(order.contact && order.contact !== order.receipt_email) row('Contact',order.contact);
  row('Order date',order.created_at?receiptDate(order.created_at):'Not recorded');
  section('Purchase');row('Product',order.product_name);row('Package',order.package_name);
  row('Package / device access',order.package_details || 'Access details not recorded for this order');
  if(order.product_category==='gaming') { row('Game account / player ID',order.game_account);row('Purchase type','One-time game top-up'); }
  else {
    row('Subscription period',order.subscription_period || 'Not specified in purchased package');
    row('Starts',order.subscription_period?receiptDate(order.subscription_started_at):'Not applicable / not recorded');
    row('Ends',order.expires_at?receiptDate(order.expires_at):order.subscription_period?'Pending payment confirmation':'Not applicable / not recorded');
  }
  section('Payment');row('Chosen method',order.payment_method || 'Not selected');row('Payment status',order.payment_status);row('Order status',order.status);
  if(order.payment_reference)row('Transaction reference',order.payment_reference);
  add('div','Total: BDT '+Number(order.amount_bdt).toFixed(2),'background:#edf3ff;color:#1949c4;border-radius:12px;padding:20px;margin-top:22px;font-size:23px;font-weight:bold');
  add('p', order.payment_status==='verified'?'Payment confirmed. Keep this receipt for your records.':'This order receipt is not proof of payment. Payment status is shown above.', 'font-size:12px;color:#52627a;margin-top:22px');
  add('p',order.product_category==='gaming'
    ? 'This is a one-time game top-up. No subscription period applies.'
    : 'Subscription periods begin when payment is confirmed. Dates use Bangladesh time (UTC+06:00).','font-size:12px;color:#52627a');
  document.body.append(root);
  try {
    await document.fonts.ready;
    const canvas=await html2canvas(root,{scale:1.5,backgroundColor:'#ffffff',logging:false});
    const height=Math.max(297,canvas.height/canvas.width*210);
    const pdf=new jsPDF({unit:'mm',format:[210,height]});
    pdf.addImage(canvas.toDataURL('image/jpeg',0.9),'JPEG',0,0,210,canvas.height/canvas.width*210,undefined,'FAST');
    pdf.setProperties({title:'QuickSub order receipt '+order.id});
    pdf.save('QuickSub-order-'+order.id.slice(0,8)+'.pdf');
  } finally { root.remove(); }
}
