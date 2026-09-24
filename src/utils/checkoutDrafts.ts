import { safeStorageGet, safeStorageSet } from './storage';
type Draft = { name: string; contact: string; note: string; packageId: string };
const key = (productId: string) => 'quicksub-checkout-draft-' + productId;
const memory = new Map<string, Draft>();
// Only checkout fields are saved. Passwords and authentication tokens never belong here.
export const checkoutDrafts = {
  get(productId: string): Draft | undefined {
    try {
      const value = JSON.parse(safeStorageGet(key(productId)) || 'null');
      if (value && typeof value === 'object' &&
          typeof value.name === 'string' && value.name.length <= 120 &&
          typeof value.contact === 'string' && value.contact.length <= 160 &&
          typeof value.note === 'string' && value.note.length <= 1000 &&
          typeof value.packageId === 'string' && value.packageId.length <= 100) return value;
    } catch { /* Ignore malformed browser storage. */ }
    return memory.get(productId);
  },
  set(productId: string, value: Draft) {
    memory.set(productId, value);
    safeStorageSet(key(productId), JSON.stringify(value));
  },
  delete(productId: string) {
    memory.delete(productId);
    safeStorageSet(key(productId), 'null');
  },
};
