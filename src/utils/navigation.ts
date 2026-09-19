const navigationEvent = 'quicksub:navigate';
export function navigate(href: string) {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) { window.location.assign(url.href); return; }
  if (url.href === window.location.href) {
    if(url.hash) { try { document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView(); } catch { /* Invalid fragment. */ } }
    return;
  }
  window.history.replaceState({ ...window.history.state, scrollY: window.scrollY }, '');
  window.history.pushState({ scrollY: 0 }, '', url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event(navigationEvent));
}
export function subscribeNavigation(listener: () => void) {
  window.addEventListener(navigationEvent, listener);
  window.addEventListener('popstate', listener);
  window.addEventListener('hashchange', listener);
  return () => { window.removeEventListener(navigationEvent, listener); window.removeEventListener('popstate', listener); window.removeEventListener('hashchange', listener); };
}
export const locationSnapshot = () => window.location.pathname + window.location.search + window.location.hash;
export const checkoutUrl = (productId?: string) => '/checkout' + (productId ? '?product=' + encodeURIComponent(productId) : '');

export const accountUrl = (returnTo: string) => '/account?next=' + encodeURIComponent(returnTo);
export function checkoutReturn() {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next) return null;
  try { const url = new URL(next, window.location.origin);
  return url.origin === window.location.origin && url.pathname === '/checkout' ? url.pathname + url.search : null; } catch { return null; }
}
