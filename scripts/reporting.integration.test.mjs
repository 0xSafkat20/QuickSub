import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startTestServer, ownerId, packageId } from "./admin-test-server.mjs";

test("admin reporting totals, boundaries, permissions and CSV exports", async (t) => {
 const env=await startTestServer({now:()=>Date.parse("2026-09-21T12:00:00Z")});
 t.after(()=>env.close());
 const request=async(path,{body,cookie="",method=body===undefined?"GET":"POST"}={})=>{
  const response=await fetch(env.base+"/api"+path,{method,headers:{"content-type":"application/json","x-quicksub-client":"web",origin:env.base,cookie},body:body===undefined?undefined:JSON.stringify(body)});
  const bytes=new Uint8Array(await response.arrayBuffer()),text=new TextDecoder().decode(bytes);return {status:response.status,body:response.headers.get("content-type")?.includes("json")?JSON.parse(text):text,headers:response.headers,bytes};
 };
 const login=async(email)=>{const result=await request("/admin/login",{body:{email,password:"test-password"}});assert.equal(result.status,200);return result.headers.get("set-cookie").split(";")[0];};
 const owner=await login("owner@example.test"),staff=await login("staff@example.test");
 const ids=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
 await env.db.query(`insert into quicksub_orders(id,tracking_hash,package_id,product_name,package_name,amount_bdt,customer_name,contact,status,payment_status,created_at,updated_at,expires_at,paid_at,refunded_at) values
  ($1,'a',$5,'=Formula product','Monthly',100,'Alpha','=HYPERLINK', 'delivered','verified','2026-09-02T00:00:00Z','2026-09-03T00:00:00Z','2026-09-25T00:00:00Z','2026-09-03',null),
  ($2,'b',$5,'Game Pass','Annual',200,'Beta','beta@example.test','cancelled','refunded','2026-09-04T00:00:00Z','2026-09-05T00:00:00Z',null,'2026-09-05','2026-09-10'),
  ($3,'c',$5,'Music','Monthly',50,'Gamma','gamma@example.test','pending','unpaid','2026-09-06T00:00:00Z','2026-09-06T00:00:00Z',null,null,null),
  ($4,'d',$5,'Outside','Monthly',999,'Delta','delta@example.test','delivered','verified','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z',null,'2026-10-01',null)`,[...ids,packageId]);
 await env.db.query(`insert into quicksub_payments(id,order_id,amount_bdt,status,email,verified_at,checked_at,created_at,refund_status,refund_reference,refund_updated_at) values
  ('report-paid',$1,100,'verified','a@example.test','2026-09-03','2026-09-03','2026-09-02','none','',null),
  ('report-refund',$2,200,'verified','b@example.test','2026-09-05','2026-09-05','2026-09-04','completed','refund-200','2026-09-10'),
  ('report-failed',$3,50,'failed','c@example.test',null,'2026-09-06','2026-09-06','none','',null)`,ids.slice(0,3));
 const query="?from=2026-09-01&to=2026-09-30&bucket=day";
 await t.test("authentication and input validation",async()=>{
  assert.equal((await request("/admin/reports"+query)).status,401);
  assert.equal((await request("/admin/reports?from=nope&to=2026-09-30",{cookie:owner})).status,400);
  assert.equal((await request("/admin/reports?from=2020-01-01&to=2026-09-30",{cookie:owner})).status,400);
 });
 await t.test("summary, trends, products, failures, refunds and expiry reconcile",async()=>{
  const result=await request("/admin/reports"+query,{cookie:owner});assert.equal(result.status,200);
  assert.deepEqual(result.body.summary,{orders:3,paid_orders:2,gross_revenue:300,refunds:200,net_revenue:100,average_order:150,payment_success_rate:66.67});
  assert.equal(result.body.trends.reduce((n,row)=>n+row.orders,0),3);
  assert.equal(result.body.trends.reduce((n,row)=>n+Number(row.net_revenue),0),100);
  assert.equal(result.body.products.length,2);assert.equal(result.body.products.reduce((n,row)=>n+Number(row.net_revenue),0),100);
  assert.equal(result.body.payments.failed,1);assert.equal(result.body.payments.completed_refunds,1);
  assert.deepEqual(new Set(result.body.payment_issues.map(row=>row.id)),new Set(["report-refund","report-failed"]));
  assert.equal(result.body.expiring.length,1);assert.equal(result.body.expiring[0].contact,"=HYPERLINK");
  await env.db.query("update quicksub_orders set delivery_note='Edited later',updated_at='2026-10-15' where id=$1",[ids[0]]);
  const stable=await request("/admin/reports"+query,{cookie:owner});assert.equal(stable.body.summary.gross_revenue,300);
 });
 await t.test("staff can view aggregates but cannot retrieve or export contacts",async()=>{
  const view=await request("/admin/reports"+query,{cookie:staff});assert.equal(view.status,200);assert.equal("contact" in view.body.expiring[0],false);
  assert.equal((await request("/admin/reports/export"+query+"&type=expiring",{cookie:staff})).status,403);
 });
 await t.test("CSV is downloadable, Excel-safe and audited",async()=>{
  const exported=await request("/admin/reports/export"+query+"&type=products",{cookie:owner});
  assert.equal(exported.status,200);assert.match(exported.headers.get("content-type"),/text\/csv/);assert.match(exported.headers.get("content-disposition"),/quicksub-products/);
  assert.deepEqual([...exported.bytes.slice(0,3)],[0xef,0xbb,0xbf]);assert.match(exported.body,/'=Formula product/);assert.match(exported.body,/Net revenue BDT/);
  const audit=await env.db.query("select action from quicksub_audit where actor=$1 and action='report-export:products'",[ownerId]);assert.equal(audit.rows.length,1);
  assert.equal((await request("/admin/reports/export"+query+"&type=unknown",{cookie:owner})).status,400);
 });
 const privilege=await env.db.query("select has_function_privilege('anon','public.quicksub_admin_report(timestamptz,timestamptz,text)','execute') allowed");
 assert.equal(privilege.rows[0].allowed,false);
});
