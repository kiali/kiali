/**
 * Join a Kiali path with PLAYWRIGHT_BASE_URL, preserving web_root (e.g. `/kiali`).
 *
 * Playwright resolves paths that start with `/` against the origin only, so
 * `request.get('/api/...')` with baseURL `http://host/kiali` becomes
 * `http://host/api/...` and misses the web root. Prefer this helper (or a
 * relative path without a leading slash) for in-cluster Kiali.
 */
export function kialiUrl(path: string): string {
  const base = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
