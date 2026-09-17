import { useSyncExternalStore } from "react";
import type { legalDocuments } from "./legal";
import { api } from "../utils/api";
type Store = {
  policies?: typeof legalDocuments | null;
  settings: {
    paymentInstructions?: string;
    supportHours?: string;
    dealEndsAt?: string;
    deals?: { productId: string; oldPrice: number }[];
  };
  faq: { id: string; question: string; answer: string }[] | null;
};
let snapshot: Store = { settings: {}, faq: null };
const listeners = new Set<() => void>();
let pending: Promise<void> | undefined;
export function refreshStore() {
  if (pending) return pending;
  pending = api<Store>("/store")
    .then((value) => {
      if (
        value &&
        typeof value.settings === "object" &&
        (value.faq === null ||
          (Array.isArray(value.faq) &&
            value.faq.every(
              (f) =>
                typeof f.id === "string" &&
                typeof f.question === "string" &&
                typeof f.answer === "string",
            )))
      ) {
        snapshot = value;
        listeners.forEach((fn) => fn());
      }
    })
    .catch(() => {})
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
export function useStore() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => snapshot,
  );
}
