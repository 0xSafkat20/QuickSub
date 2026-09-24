import { useEffect, useRef } from 'react';
import { safeStorageGet, safeStorageSet } from './storage';
export type SessionScope = 'customer' | 'admin';
const key = (scope: SessionScope) => `quicksub-session-expiry-${scope}`;
const eventName = 'quicksub-session-change';

export function updateSessionExpiry(scope: SessionScope, expiresAt: string) {
  if (!Number.isFinite(Date.parse(expiresAt))) return;
  safeStorageSet(key(scope), expiresAt);
  window.dispatchEvent(new CustomEvent(eventName, { detail: { scope, expired: false } }));
}
export function endSession(scope: SessionScope) {
  safeStorageSet(key(scope), ''); // Leave orders, checkout drafts and favorites untouched.
  window.dispatchEvent(new CustomEvent(eventName, { detail: { scope, expired: true } }));
}

export function useSessionExpiry(scope: SessionScope, onExpire: () => void) {
  const callback = useRef(onExpire);
  callback.current = onExpire;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function schedule() {
      clearTimeout(timer);
      const deadline = Date.parse(safeStorageGet(key(scope)) || '');
      if (!Number.isFinite(deadline)) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) { endSession(scope); return; }
      timer = setTimeout(schedule, Math.min(remaining, 2147483647));
    }
    function changed(event: Event) {
      const detail = (event as CustomEvent<{scope: SessionScope; expired: boolean}>).detail;
      if (detail.scope !== scope) return;
      if (detail.expired) { clearTimeout(timer); callback.current(); }
      else schedule();
    }
    function storage(event: StorageEvent) {
      if (event.key !== key(scope)) return;
      if (!event.newValue) { clearTimeout(timer); callback.current(); }
      else schedule();
    }
    window.addEventListener(eventName, changed);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      clearTimeout(timer);
      window.removeEventListener(eventName, changed);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [scope]);
}
