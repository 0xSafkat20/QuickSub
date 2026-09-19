import type { AnchorHTMLAttributes } from 'react';
import { navigate } from '../../utils/navigation';
export default function SiteLink({ href = '/', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === '_blank' || props.download) return;
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || href.startsWith('#')) return;
    event.preventDefault(); navigate(href);
  }} />;
}
