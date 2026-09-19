const navigationEvent = 'quicksub:navigate';
export function navigate(href: string) {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin) { window.location.assign(url.href); return; }
  window.history.replaceState({ ...window.history.state, scrollY: window.scrollY }, '');
  window.history.pushState({ scrollY: 0 }, '', url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event(navigationEvent));
}
export function subscribeNavigation(listener: () => void) {
  window.addEventListener(navigationEvent, listener);
  window.addEventListener('popstate', listener);
  return () => { window.removeEventListener(navigationEvent, listener); window.removeEventListener('popstate', listener); };
}
export const locationSnapshot = () => window.location.pathname + window.location.search;
export const checkoutUrl = (productId?: string) => '/checkout' + (productId ? '?product=' + encodeURIComponent(productId) : '');
