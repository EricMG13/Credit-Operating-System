// design-sync shim: Claude Design has no Next.js router — return inert defaults.
const noop = () => {};

export function usePathname() { return '/'; }
export function useRouter() {
  return { push: noop, replace: noop, prefetch: noop, back: noop, forward: noop, refresh: noop };
}
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return {} as Record<string, string>; }
export function useSelectedLayoutSegment() { return null; }
export function redirect() {}
export function notFound() {}
