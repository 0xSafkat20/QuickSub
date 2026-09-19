import { accountUrl, checkoutUrl } from '../../utils/navigation';
import SiteLink from '../ui/SiteLink';
import DemoPayment from "./DemoPayment";
import { motion, useReducedMotion } from "framer-motion";
import OnlinePayment from "./OnlinePayment";
import { useEffect, useState, useRef } from "react";
import { api } from "../../utils/api";
import { useStore } from "../../data/store";
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
};
const drafts = new Map<string, {name:string;contact:string;note:string;packageId:string}>();
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
  const [gatewayBlocked, setGatewayBlocked] = useState(true);
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
        <p className="break-all">
          <b>Private access code:</b> {accessCode}
        </p>
        <p className="text-xs">
          Save these details to track your order later. Keep your access code
          private.
        </p>
        <button
          type="button"
          className="text-brand-600 underline"
          onClick={() => {
            const blob = new Blob(
              [
                `QuickSub order\nOrder ID: ${order.id}\nPrivate access code: ${accessCode}\n${order.product_name} / ${order.package_name}\nAmount: BDT ${order.amount_bdt}\nTrack at ${window.location.origin}/track`,
              ],
              { type: "text/plain" },
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "QuickSub-order-" + order.id.slice(0, 8) + ".txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Download order receipt
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
      () => receiptFor(productId).order,
    );
  const [savedProfile, setSavedProfile] = useState<{name:string;contact:string}|null>(null);
  const [accountError, setAccountError] = useState('');
  useEffect(() => { let active=true; api<{user:unknown;profile:{name:string;contact:string}|null}>('/account/session').then(data=>{if(active)setSavedProfile(data.user?data.profile:null);}).catch(()=>{if(active)setAccountError('Account details could not be loaded. Sign in again to save this order to your account.');}); return()=>{active=false;}; }, []);
  const [credentials, setCredentials] = useState(() => receiptFor(productId));
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    api<{ packages: Plan[] }>("/packages/" + encodeURIComponent(productId))
      .then((data) => {
        if (!cancelled) {
          setPlans(data.packages);
          setSelected(data.packages.some(p=>p.id===drafts.get(productId)?.packageId) ? drafts.get(productId)!.packageId : data.packages[0]?.id || "");
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "We could not load packages. Please retry; your checkout stays on this page.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, attempt]);
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
              receipts.delete(productId);
              setCredentials(receiptFor(productId));
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
      <p role={error ? 'alert' : 'status'} className="text-sm text-ink-600">{error || `There are no purchasable packages for ${productName} yet. Please check again shortly.`}</p>
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
            packageId: selected,
            expectedPrice: Number(plan?.price_bdt),
            name: values.get("name"),
            contact: values.get("contact"),
            note: values.get("note"),
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
      {savedProfile ? <button type="button" className="text-brand-600 underline" onClick={e=>{const form=e.currentTarget.form; if(form){(form.elements.namedItem("name") as HTMLInputElement).value=savedProfile.name;(form.elements.namedItem("contact") as HTMLInputElement).value=savedProfile.contact;drafts.set(productId,{name:savedProfile.name,contact:savedProfile.contact,note:(form.elements.namedItem("note") as HTMLTextAreaElement).value,packageId:selected});}}}>Use my saved details</button> : <p className="text-xs"><SiteLink href={accountUrl(checkoutUrl(productId))} className="text-brand-600 underline">Sign in or create an account</SiteLink> to save real purchases to your order history.</p>}
      {accountError && <p className="text-xs text-amber-700">{accountError}</p>}
      <label className="block font-semibold">
        Choose your package
        <select
          className={input + " mt-2"}
          name="packageId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
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
      <label className="block">
        Delivery details / game player ID (optional)
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
