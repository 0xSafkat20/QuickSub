export function safeStorageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = window.localStorage;
    if (!storage) return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    const storage = window.localStorage;
    if (!storage) return;
    storage.setItem(key, value);
  } catch {
    // Some privacy/ad-block tools block storage access. Ignore it so the app keeps rendering.
  }
}
