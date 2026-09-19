import { createPortal } from 'react-dom';
import { useState } from "react";
import { Package, X } from "lucide-react";
import { api } from "../../utils/api";
import { OrderReceipt, type TrackedOrder } from "./CustomerOrder";
export default function OrderTracking({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(new URLSearchParams(window.location.search).get("payment") === "return"),
    [id, setId] = useState(""),
    [accessCode, setAccessCode] = useState(""),
    [order, setOrder] = useState<TrackedOrder | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      {!inline && <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-brand-200 text-brand-700 text-sm font-semibold hover:bg-brand-50"
      >
        <Package size={16} />
        Track Order
      </button>}
      {(open || inline) && (inline ? content() : createPortal(content(), document.body))}
    </>
  );
  function content() { return (
        <div className={inline ? "" : "fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"}>
          <section
            role={inline ? undefined : "dialog"}
            aria-modal={inline ? undefined : true}
            aria-label="Track your order"
            className={inline ? "w-full" : "bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl"}
          >
            <div className="gradient-primary p-6 flex items-center justify-between text-white">
              <h2 className="font-heading font-bold text-lg">
                Track Your Order
              </h2>
              {!inline && <button
                aria-label="Close tracking"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>}
            </div>
            <div className="p-6">
              {new URLSearchParams(window.location.search).get("payment") === "return" && <p className="mb-4 text-sm">Welcome back. Enter your saved receipt details, then check payment status. Returning from checkout does not confirm payment.</p>}
              <form
                className="space-y-3 mb-5 text-sm"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  setOrder(null);
                  try {
                    const result = await api<{ order: TrackedOrder }>(
                      "/orders/track",
                      { id: id.trim(), accessCode: accessCode.trim() },
                    );
                    setOrder(result.order);
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="block">
                  Order ID
                  <input
                    required
                    className="w-full border border-brand-200 rounded-xl p-3 mt-1"
                    value={id}
                    onChange={(e) => {
                      setId(e.target.value);
                      setOrder(null);
                    }}
                  />
                </label>
                <label className="block">
                  Private access code
                  <input
                    required
                    className="w-full border border-brand-200 rounded-xl p-3 mt-1"
                    value={accessCode}
                    onChange={(e) => {
                      setAccessCode(e.target.value);
                      setOrder(null);
                    }}
                  />
                </label>
                <p className="text-xs text-ink-400">
                  Use the ID and access code from your order receipt.
                </p>
                <button
                  disabled={busy}
                  className="px-5 py-3 gradient-primary text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {busy ? "Checking…" : "Track order"}
                </button>
              </form>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              {order && (
                <OrderReceipt
                  order={order}
                  accessCode={accessCode.trim()}
                  onUpdate={setOrder}
                />
              )}
            </div>
          </section>
        </div>
    );
  }
}
