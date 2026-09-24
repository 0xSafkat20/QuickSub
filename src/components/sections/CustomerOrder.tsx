import { rememberReceipt } from '../../utils/savedReceipts';
import type { CartResponse } from '../../utils/cart';
import { checkoutDrafts as drafts } from '../../utils/checkoutDrafts';
import { useSessionExpiry } from '../../utils/session';
import { accountUrl, checkoutUrl, navigate } from '../../utils/navigation';
import SiteLink from '../ui/SiteLink';
import DemoPayment from "./DemoPayment";
import { motion, useReducedMotion } from "framer-motion";
import OnlinePayment from "./OnlinePayment";
import { useEffect, useState, useRef } from "react";
import { api } from "../../utils/api";
import { useStore } from "../../data/store";
import { useProducts } from '../../data/catalog';
import { downloadReceipt, receiptDate } from '../../utils/receiptPdf';
type Plan = { id: string; name: string; details: string; price_bdt: number; demo?: boolean };
export type TrackedOrder = {
  id: string;
  product_name: string;
  package_name: string;
  amount_bdt: number;
  status: string;
  payment_status: string;
  delivery_note: string;
  updated_at: string;
  customer_name?: string; contact?: string; receipt_email?: string; game_account?: string;
  package_details?: string; product_category?: string; subscription_period?: string;
  subscription_started_at?: string | null; expires_at?: string | null; created_at?: string;
  payment_method?: string; payment_reference?: string;
};

const receipts = new Map<
  string,
  { id: string; accessCode: string; order: TrackedOrder | null }
>();
function receiptFor(productId: string) {
  let receipt = receipts.get(productId);
  if (!receipt) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    receipt = {
      id:
        h.slice(0, 8) +
        "-" +
        h.slice(8, 12) +
        "-" +
        h.slice(12, 16) +
        "-" +
        h.slice(16, 20) +
        "-" +
        h.slice(20),
      accessCode: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
      order: null,
    };
    receipts.set(productId, receipt);
  }
  return receipt;
}
const input =
  "w-full border border-brand-200 rounded-xl px-3 py-2.5 text-sm bg-white text-ink-800";
const button =
  "px-5 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50";
export function OrderReceipt({
  order,
  accessCode,
  onUpdate,
}: {
  order: TrackedOrder;
  accessCode: string;
  onUpdate: (order: TrackedOrder) => void;
}) {
  const { settings } = useStore();
  useEffect(()=>rememberReceipt({id:order.id,accessCode}),[order.id,accessCode]);
  const [gatewayBlocked, setGatewayBlocked] = useState(true);
  const [method,setMethod]=useState('bKash');
  const [downloading,setDownloading]=useState(false);
  const [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-4 text-sm text-ink-700">
      <div className="rounded-xl bg-brand-50 p-4 space-y-2">
        <strong>
          {order.product_name} · {order.package_name}
        </strong>
        <p>
          ৳{order.amount_bdt} · Order: {order.status} · Payment:{" "}
          {order.payment_status}
        </p>
        <p className="break-all">
          <b>Order ID:</b> {order.id}
        </p>
        <p><b>Customer:</b> {order.customer_name || 'Not recorded'}</p>
        <p className="break-all"><b>Email:</b> {order.receipt_email || (order.contact?.includes('@')?order.contact:'Not provided')}</p>
        <p><b>Payment method:</b> {order.payment_method || 'Choose a payment option below'}</p>
        {order.product_category==='gaming' ? <p><b>Game account / player ID:</b> {order.game_account || 'Not recorded'}</p> : order.subscription_period && <><p><b>Period:</b> {order.subscription_period}</p><p><b>Starts:</b> {receiptDate(order.subscription_started_at)}</p><p><b>Ends:</b> {receiptDate(order.expires_at)}</p></>}
        {order.package_details&&<p className="whitespace-pre-wrap"><b>Package / device access:</b> {order.package_details}</p>}
        <button
          type="button"
          className="text-brand-600 underline"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);setError('');
            try {const result=await api<{order:TrackedOrder}>('/orders/track',{id:order.id,accessCode});onUpdate(result.order);await downloadReceipt(result.order);}
            catch(err){setError((err as Error).message);}finally{setDownloading(false);}
          }}
        >
          {downloading?'Preparing PDF…':'Download order receipt (PDF)'}
        </button>
      </div>
      <OnlinePayment order={order} accessCode={accessCode} onUpdate={onUpdate} onBlockingChange={setGatewayBlocked} />
      {order.delivery_note && (
        <p className="whitespace-pre-wrap rounded-xl bg-green-50 p-4">
          {order.delivery_note}
        </p>
      )}
      {!gatewayBlocked && order.status === "pending" &&
        ["unpaid", "rejected"].includes(order.payment_status) && (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("/orders/payment", {
                  id: order.id,
                  accessCode,
                  reference,
                  method,
                });
                const result = await api<{ order: TrackedOrder }>(
                  "/orders/track",
                  { id: order.id, accessCode },
                );
                onUpdate(result.order);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="whitespace-pre-wrap">
              {settings.paymentInstructions ||
                "Contact support with your order ID to confirm payment instructions before paying."}
            </p>
            <label className="block">Payment method<select className={input+' mt-2'} value={method} onChange={e=>setMethod(e.target.value)}><option>bKash</option><option>Nagad</option><option>Rocket</option><option>Bank transfer</option><option>Other manual payment</option></select></label>
            <label className="block">
              Payment method and transaction reference
              <input
                className={input + " mt-2"}
                value={reference}
                maxLength={160}
                minLength={4}
                required
                placeholder="e.g. bKash — transaction reference"
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <button className={button} disabled={busy}>
              {busy ? "Submitting…" : "Submit payment reference"}
            </button>
            <p className="text-xs text-ink-400">
              Your payment will be reviewed by the store team.
            </p>
          </form>
        )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
export default function CustomerOrder({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const query = new URLSearchParams(window.location.search);
  const products=useProducts();
  const isGame=products.find(p=>p.id===productId)?.category==='gaming';
  const fromCart = query.get('cart') === '1';
  const requestedPackage = query.get('package') || '';
  const receiptKey = fromCart ? productId + ':' + requestedPackage + ':' + query.get('saved') : productId;
  const draft = drafts.get(productId);
  const reducedMotion = useReducedMotion();
  const stepRef = useRef<HTMLDivElement>(null);
  const [demoPlan, setDemoPlan] = useState<Plan | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]),
    [selected, setSelected] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [order, setOrder] = useState<TrackedOrder | null>(
      () => receiptFor(receiptKey).order,
    );
  const [savedProfile, setSavedProfile] = useState<{name:string;contact:string}|null>(null);
  const [accountError, setAccountError] = useState('');
  const [cartMessage,setCartMessage] = useState('');
  useSessionExpiry('customer', () => { setSavedProfile(null); setAccountError('Session ended. Your checkout draft is saved. Sign in again to link your purchase to your account.'); });
  useEffect(() => { let active=true; api<{user:unknown;profile:{name:string;contact:string}|null}>('/account/session').then(data=>{if(active)setSavedProfile(data.user?data.profile:null);}).catch(()=>{if(active)setAccountError('Account details could not be loaded. Sign in again to save this order to your account.');}); return()=>{active=false;}; }, []);
  const [credentials, setCredentials] = useState(() => receiptFor(receiptKey));
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    void (async () => {
      const data = await api<{ packages: Plan[] }>("/packages/" + encodeURIComponent(productId));
      if (fromCart) {
        const cart = await api<CartResponse>('/cart');
        const item = cart.items.find(item => item.package_id === requestedPackage && item.product_id === productId);
        if (!item || !item.available || !data.packages.some(plan => plan.id === item.package_id)) throw new Error('This cart item is unavailable or has already been checked out. Open your cart or account to continue.');
        if (!cancelled) drafts.set(productId,{name:item.name,contact:item.contact,note:item.note,packageId:item.package_id});
      }
      if (!cancelled) {
        setPlans(data.packages);
        setSelected(data.packages.some(p=>p.id===drafts.get(productId)?.packageId) ? drafts.get(productId)!.packageId : data.packages[0]?.id || "");
      }
    })()
      .catch((err) => { if (!cancelled) { setPlans([]); setError(err.message || "We could not load packages. Please retry."); } })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, attempt, fromCart, requestedPackage]);
  useEffect(() => {
    if (order || demoPlan) {
      stepRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
      stepRef.current?.focus({ preventScroll: true });
    }
  }, [order, demoPlan, reducedMotion]);
  if (demoPlan) return <motion.div ref={stepRef} tabIndex={-1} className="outline-none" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
    <DemoPayment productName={productName} packageName={demoPlan.name} amount={demoPlan.price_bdt} onBack={() => setDemoPlan(null)} />
  </motion.div>;
  if (order)
    return (
      <motion.div ref={stepRef} tabIndex={-1} className="outline-none" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
        <h2 className="text-xl font-bold mb-4">Payment &amp; receipt</h2>
        <OrderReceipt
          order={order}
          accessCode={credentials.accessCode}
          onUpdate={(value) => {
            credentials.order = value;
            setOrder(value);
          }}
        />
        <button
          type="button"
          className="mt-4 text-sm text-brand-600 underline"
          onClick={() => {
            if (
              window.confirm(
                "Have you saved your receipt? Start another order for this product?",
              )
            ) {
              drafts.delete(productId);
              receipts.delete(receiptKey);
              if (fromCart) { navigate(checkoutUrl(productId)); return; }
              setCredentials(receiptFor(receiptKey));
              setOrder(null);
            }
          }}
        >
          Start another order
        </button>
      </motion.div>
    );
  if (loading)
    return <p role="status" className="text-sm text-ink-400 py-6">Checking available packages…</p>;
  if (!plans.length)
    return <div className="space-y-4 rounded-xl bg-brand-50 p-5">
      <h2 className="font-bold text-lg">{error ? 'Checkout temporarily unavailable' : 'Packages coming soon'}</h2>
      <p role={error ? 'alert' : 'status'} className="text-sm text-ink-600">{error || `There are no purchasable packages for ${productName} yet. Please check again shortly.`}</p><SiteLink href="/cart" className="text-brand-600 underline">Open my cart</SiteLink>
      <button type="button" className={button} onClick={() => setAttempt(n => n + 1)}>Retry loading packages</button>
    </div>;
  const plan = plans.find((p) => p.id === selected);
  return (
    <form
      className="space-y-3 text-sm"
      onChange={e=>{const values=new FormData(e.currentTarget);drafts.set(productId,{name:String(values.get("name")||""),contact:String(values.get("contact")||""),note:String(values.get("note")||""),packageId:String(values.get("packageId")||selected)});}}
      onSubmit={async (e) => {
        e.preventDefault();
        const values = new FormData(e.currentTarget);
        if (plan?.demo) { setDemoPlan(plan); return; }
        setBusy(true);
        setError("");
        try {
          const result = await api<{ order: TrackedOrder }>("/orders", {
            ...credentials,
            fromCart,
            packageId: selected,
            expectedPrice: Number(plan?.price_bdt),
            name: values.get("name"),
            contact: values.get("contact"),
            note: values.get("note"),
            email: values.get('receiptEmail') || (String(values.get('contact')).includes('@') ? values.get('contact') : ''),
            gameAccount: values.get('gameAccount') || '',
          });
          credentials.order = result.order;
          setOrder(result.order);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {plan?.demo && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900"><strong>Demo packages</strong> — sample prices for testing. No money will be collected.</p>}
      <h2 className="text-xl font-bold">Package &amp; delivery details</h2>
      {savedProfile ? <button type="button" className="text-brand-600 underline" onClick={e=>{const form=e.currentTarget.form; if(form){(form.elements.namedItem("name") as HTMLInputElement).value=savedProfile.name;(form.elements.namedItem("contact") as HTMLInputElement).value=savedProfile.contact;drafts.set(productId,{name:savedProfile.name,contact:savedProfile.contact,note:(form.elements.namedItem("note") as HTMLTextAreaElement).value,packageId:selected});}}}>Use my saved details</button> : <p className="text-xs"><SiteLink href={accountUrl(fromCart ? '/checkout'+window.location.search : checkoutUrl(productId))} className="text-brand-600 underline">Sign in or create an account</SiteLink> to save real purchases to your order history.</p>}
      {accountError && <p className="text-xs text-amber-700">{accountError}</p>}
      <label className="block font-semibold">
        Choose your package
        <select
          className={input + " mt-2"}
          name="packageId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={fromCart}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — ৳{p.price_bdt}
            </option>
          ))}
        </select>
      </label>
      {plan?.details && (
        <p className="text-ink-400 whitespace-pre-wrap">{plan.details}</p>
      )}
      <label className="block">
        Your name
        <input
          className={input + " mt-1"}
          name="name"
          defaultValue={draft?.name || ""}
          placeholder="Enter your name"
          required
          maxLength={120}
          autoComplete="name"
        />
      </label>
      <label className="block">
        Email or phone number
        <input
          className={input + " mt-1"}
          name="contact"
          defaultValue={draft?.contact || ""}
          placeholder="yourname@gmail.com"
          required
          minLength={5}
          maxLength={160}
          autoComplete="email"
        />
      </label>
      <label className="block">Receipt email<input className={input+' mt-1'} name="receiptEmail" type="email" required maxLength={160} autoComplete="email" defaultValue={draft?.contact?.includes('@')?draft.contact:''} placeholder="you@example.com" /></label>
      {isGame&&<label className="block">Game account name / player ID<input className={input+' mt-1'} name="gameAccount" required maxLength={160} placeholder="Player ID, account name and server / zone if required" /></label>}
      <label className="block">
        Delivery details (optional)
        <textarea
          className={input + " mt-1"}
          name="note"
          defaultValue={draft?.note || ""}
          maxLength={1000}
          placeholder="Do not share passwords, OTPs or payment PINs."
        />
      </label>
      <p className="text-xs text-ink-400">
        {plan?.demo ? "Demo details stay in this preview and are not submitted." : "Your contact and order details are saved to fulfill this order. Continue to choose an available payment method."}
      </p>
      {cartMessage && <p role="status" className="rounded-xl bg-brand-50 p-3">{cartMessage} <SiteLink href="/cart" className="font-semibold underline">View my cart</SiteLink></p>}
      {!plan?.demo && <button type="button" disabled={busy} className="w-full rounded-xl border border-brand-300 text-brand-700 px-4 py-3 font-semibold disabled:opacity-50" onClick={async e=>{
        const form=e.currentTarget.form;
        if(!form || !selected)return;
        const values=new FormData(form);
        const details={name:String(values.get('name')||''),contact:String(values.get('contact')||''),note:String(values.get('note')||'')};
        drafts.set(productId,{...details,packageId:selected});
        setBusy(true);setError('');setCartMessage('');
        try {await api('/cart/items/'+selected,details,'PUT');setCartMessage(fromCart?'Cart details updated.':'Package saved to your account cart.');}
        catch(err){setError((err as Error).message);}finally{setBusy(false);}
      }}>{busy?'Please wait…':fromCart?'Save cart changes':'Add to cart'}</button>}
      {fromCart && <SiteLink href="/cart" className="inline-block text-brand-600 underline">Back to my cart</SiteLink>}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button className={button + " w-full"} disabled={busy}>
        {busy ? "Creating order…" : plan?.demo ? `Continue to demo payment · ৳${plan.price_bdt}` : `Continue to payment · ৳${plan?.price_bdt}`}
      </button>
    </form>
  );
}
