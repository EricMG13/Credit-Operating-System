// design-sync shim: Claude Design has no Next.js runtime — render a plain anchor.
import React from 'react';

export default function Link({ href, prefetch, replace, scroll, locale, shallow, passHref, legacyBehavior, children, ...rest }: any) {
  return React.createElement('a', { href: typeof href === 'string' ? href : '#', ...rest }, children);
}
