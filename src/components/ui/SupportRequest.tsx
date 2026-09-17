import { useState } from "react";
import { api } from "../../utils/api";
export default function SupportRequest({
  kind = "support",
  message = "",
}: {
  kind?: "support" | "restock";
  message?: string;
}) {
  const [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (done)
    return (
      <p role="status" className="text-sm text-green-700">
        Request received. Our team will contact you.
      </p>
    );
  return (
    <form
      className="space-y-3 text-sm mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const values = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await api("/requests", {
            kind,
            contact: values.get("contact"),
            message: message + (values.get("message") || ""),
          });
          setDone(true);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        Your email or phone
        <input
          name="contact"
          required
          minLength={5}
          maxLength={160}
          className="mt-1 w-full p-3 border border-brand-200 rounded-xl"
        />
      </label>
      {kind === "support" && (
        <label className="block">
          How can we help?
          <textarea
            name="message"
            required
            maxLength={1500}
            className="mt-1 w-full p-3 border border-brand-200 rounded-xl"
            placeholder="Do not include passwords or payment PINs."
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="px-5 py-3 bg-brand-600 text-white rounded-xl font-semibold disabled:opacity-50"
      >
        {busy
          ? "Sending…"
          : kind === "restock"
            ? "Request restock notification"
            : "Send support request"}
      </button>
    </form>
  );
}
