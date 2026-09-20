import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, TrendingUp } from "lucide-react";
import { api } from "../utils/api";

type Trend = { bucket:string; orders:number; paid_orders:number; gross_revenue:number; refunds:number; net_revenue:number };
type ProductReport = { product_name:string; package_name:string; paid_orders:number; refunded_orders:number; gross_revenue:number; refunds:number; net_revenue:number };
type PaymentIssue = { id:string; order_id:string; product_name:string; package_name:string; amount_bdt:number; status:string; refund_status:string; created_at:string };
type Expiring = { id:string; customer_name:string; contact:string; product_name:string; package_name:string; amount_bdt:number; expires_at:string; days_remaining:number };
type Report = {
 period:{from:string;to:string;bucket:string;timezone:string};generatedAt:string;
 summary:{orders:number;paid_orders:number;gross_revenue:number;refunds:number;net_revenue:number;average_order:number;payment_success_rate:number};
 trends:Trend[];products:ProductReport[];
 payments:{total:number;verified:number;pending:number;failed:number;cancelled:number;review:number;completed_refunds:number};
 payment_issues:PaymentIssue[];expiring:Expiring[];
};
const money=(value:number|string)=>"৳"+Number(value||0).toLocaleString("en-BD",{maximumFractionDigits:2});
const day=(date:Date)=>date.toISOString().slice(0,10);
const today=()=>{const now=new Date();return day(new Date(now.getTime()-now.getTimezoneOffset()*60000));};
const daysAgo=(count:number)=>{const date=new Date();date.setDate(date.getDate()-count);return day(date);};
const daysAhead=(count:number)=>{const date=new Date();date.setDate(date.getDate()+count);return day(date);};
const friendly=(value:string)=>new Date(value).toLocaleDateString("en-BD",{year:"numeric",month:"short",day:"numeric"});

export default function AdminReports({role}:{role:"owner"|"staff"}) {
 const [from,setFrom]=useState(()=>daysAgo(29)),[to,setTo]=useState(today),[bucket,setBucket]=useState("day");
 const [report,setReport]=useState<Report|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[downloading,setDownloading]=useState("");
 const query=useMemo(()=>new URLSearchParams({from,to,bucket}).toString(),[from,to,bucket]);
 const load=useCallback(async()=>{setLoading(true);setError("");try{setReport(await api<Report>("/admin/reports?"+query));}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[query]);
 useEffect(()=>{void load();},[load]);
 const preset=(past:number,future=0)=>{setFrom(past?daysAgo(past-1):today());setTo(future?daysAhead(future):today());setBucket(past>90?"month":past>31?"week":"day");};
 const download=async(type:string)=>{setDownloading(type);setError("");try{const response=await fetch(`/api/admin/reports/export?${query}&type=${type}`,{credentials:"same-origin"});if(!response.ok){const body=await response.json().catch(()=>({error:"Export failed."}));throw new Error(body.error||"Export failed.");}const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]||`quicksub-${type}.csv`;link.click();URL.revokeObjectURL(url);}catch(e){setError((e as Error).message);}finally{setDownloading("");}};
 const max=Math.max(1,...(report?.trends||[]).map(row=>Number(row.gross_revenue)));
 return <section className="qs-report" aria-busy={loading}>
  <div className="qs-admin-card qs-report-filters">
   <div className="qs-report-presets" aria-label="Reporting period presets">
    <button onClick={()=>preset(7)}>7 days</button><button onClick={()=>preset(30)}>30 days</button><button onClick={()=>preset(90)}>90 days</button><button onClick={()=>preset(0,60)}>Next 60 days</button>
   </div>
   <div className="qs-report-date-grid">
    <label>From<input aria-label="Report start date" type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label>
    <label>To<input aria-label="Report end date" type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label>
    <label>Group by<select aria-label="Report grouping" value={bucket} onChange={e=>setBucket(e.target.value)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
    <button className="qs-admin-secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={16} className={loading?"animate-spin":""}/>Refresh report</button>
   </div>
   <small>All dates use Bangladesh time. Revenue includes verified and subsequently refunded orders; net revenue deducts completed refunds.</small>
  </div>
  {error&&<div className="qs-admin-error" role="alert">{error}<button onClick={()=>void load()}>Retry</button></div>}
  {loading&&!report&&<div className="qs-admin-card qs-admin-empty" role="status">Preparing your report…</div>}
  {report&&<>
   <div className="qs-report-metrics">
    {[["Net revenue",money(report.summary.net_revenue)],["Gross revenue",money(report.summary.gross_revenue)],["Completed refunds",money(report.summary.refunds)],["Orders",report.summary.orders],["Paid orders",report.summary.paid_orders],["Average order",money(report.summary.average_order)],["Payment success",Number(report.summary.payment_success_rate).toFixed(1)+"%"]].map(([label,value])=><div className="qs-admin-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
   </div>
   <div className="qs-report-grid">
    <section className="qs-admin-card qs-report-wide">
     <div className="qs-admin-section-heading"><div><h2>Revenue and orders</h2><p className="qs-admin-muted">Gross revenue by {bucket}, with order volume underneath.</p></div><button className="qs-admin-secondary" disabled={!!downloading} onClick={()=>void download("trends")}><Download size={15}/>CSV</button></div>
     {report.trends.length?<div className="qs-report-chart" role="img" aria-label="Revenue trend chart">{report.trends.map(row=><div className="qs-report-bar-column" key={row.bucket} title={`${friendly(row.bucket)}: ${money(row.gross_revenue)}, ${row.orders} orders`}><div className="qs-report-bar-track"><span style={{height:`${Math.max(3,Number(row.gross_revenue)/max*100)}%`}}/></div><strong>{row.orders}</strong><small>{friendly(row.bucket)}</small></div>)}</div>:<div className="qs-admin-empty">No orders in this period.</div>}
    </section>
    <section className="qs-admin-card">
     <h2>Payment health</h2><div className="qs-payment-health">{[["Verified",report.payments.verified],["Pending",report.payments.pending],["Needs review",report.payments.review],["Failed",report.payments.failed],["Cancelled",report.payments.cancelled],["Refunded",report.payments.completed_refunds]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </section>
   </div>
   <section className="qs-admin-card qs-admin-table-wrap qs-report-section">
    <div className="qs-report-table-heading"><div><h2>Best-selling products</h2><p className="qs-admin-muted">Ranked by net revenue from historical order snapshots.</p></div><button className="qs-admin-secondary" disabled={!!downloading} onClick={()=>void download("products")}><Download size={15}/>CSV</button></div>
    <table><thead><tr><th>Product</th><th>Paid orders</th><th>Gross</th><th>Refunds</th><th>Net revenue</th></tr></thead><tbody>{report.products.map(row=><tr key={row.product_name+row.package_name}><td><strong>{row.product_name}</strong><small>{row.package_name}</small></td><td>{row.paid_orders}</td><td>{money(row.gross_revenue)}</td><td>{money(row.refunds)}</td><td><strong>{money(row.net_revenue)}</strong></td></tr>)}</tbody></table>
    {!report.products.length&&<div className="qs-admin-empty">No paid products in this period.</div>}
   </section>
   <section className="qs-admin-card qs-admin-table-wrap qs-report-section">
    <div className="qs-report-table-heading"><div><h2>Payment failures and refunds</h2><p className="qs-admin-muted">Transactions needing attention or carrying refund activity.</p></div><button className="qs-admin-secondary" disabled={!!downloading} onClick={()=>void download("payments")}><Download size={15}/>CSV</button></div>
    <table><thead><tr><th>Transaction</th><th>Product</th><th>Amount</th><th>Payment</th><th>Refund</th><th>Created</th></tr></thead><tbody>{report.payment_issues.map(row=><tr key={row.id}><td><strong>{row.id}</strong><small>Order {row.order_id.slice(0,8)}</small></td><td>{row.product_name}<small>{row.package_name}</small></td><td>{money(row.amount_bdt)}</td><td><span className="qs-admin-badge">{row.status}</span></td><td><span className="qs-admin-badge">{row.refund_status}</span></td><td>{friendly(row.created_at)}</td></tr>)}</tbody></table>
    {!report.payment_issues.length&&<div className="qs-admin-empty">No payment failures or refunds in this period.</div>}
   </section>
   <section className="qs-admin-card qs-admin-table-wrap qs-report-section">
    <div className="qs-report-table-heading"><div><h2>Expiring subscriptions</h2><p className="qs-admin-muted">Delivered subscriptions expiring inside the selected dates.</p></div>{role==="owner"?<button className="qs-admin-secondary" disabled={!!downloading} onClick={()=>void download("expiring")}><Download size={15}/>CSV</button>:<span className="qs-admin-muted">Contact export is owner-only</span>}</div>
    <table><thead><tr><th>Customer</th><th>Subscription</th><th>Expires</th><th>Time remaining</th><th>Order</th></tr></thead><tbody>{report.expiring.map(row=><tr key={row.id}><td><strong>{row.customer_name}</strong>{role==="owner"&&<small>{row.contact}</small>}</td><td>{row.product_name}<small>{row.package_name}</small></td><td>{friendly(row.expires_at)}</td><td><span className={"qs-admin-badge "+(row.days_remaining>=0?"good":"")}>{row.days_remaining<0?`${Math.abs(row.days_remaining)} days expired`:row.days_remaining===0?"Today":`${row.days_remaining} days`}</span></td><td>{row.id.slice(0,8)}</td></tr>)}</tbody></table>
    {!report.expiring.length&&<div className="qs-admin-empty">No delivered subscriptions expire in this period. Try “Next 60 days”.</div>}
   </section>
   <p className="qs-report-generated"><TrendingUp size={14}/>Generated {new Date(report.generatedAt).toLocaleString()} · {report.period.timezone}</p>
  </>}
 </section>;
}
