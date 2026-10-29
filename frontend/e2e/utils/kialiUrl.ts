/**
 * Join a Kiali path with PLAYWRIGHT_BASE_URL, preserving web_root (e.g. `/kiali`).
 *
 * Playwright resolves paths that start with `/` against the origin only, so
 * `request.get('/api/...')` with baseURL `http://host/kiali` becomes
 * `http://host/api/...` and misses the web root. Prefer this helper (or a
 * relative path without a leading slash) for in-cluster Kiali.
 *
 * In OSSMC mode the suite runs inside the OpenShift Console, where the Kiali
 * API is served behind the console plugin proxy and the Kiali SPA routes live
 * under /ossmconsole (namespace-scoped detail pages on the console's own /k8s
 * routes). kialiUrl translates both, mirroring the Cypress translation layer
 * in the OSSMC repo (plugin/cypress/support/commands.ts).
 */
export function kialiUrl(path: string): string {
  const base = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${process.env.PLAYWRIGHT_OSSMC === 'true' ? toOssmcPath(suffix) : suffix}`;
}

const OSSMC_API_PROXY_PREFIX = '/api/proxy/plugin/ossmconsole/kiali';

function toOssmcPath(path: string): string {
  if (path.startsWith('/api/')) {
    return `${OSSMC_API_PROXY_PREFIX}${path}`;
  }
  if (!path.startsWith('/console/')) {
    // Already a console URL (/ossmconsole/..., /k8s/...).
    return path;
  }

  const [pathname, search = ''] = path.split('?');
  const query = search ? `?${search}` : '';
  const [page, namespace, type, ...details] = pathname.slice('/console/'.length).split('/');
  const name = details.join('/');

  if (page === 'namespaces') {
    if (!namespace) {
      return `/ossmconsole/namespaces${query}`;
    }
    if (!type) {
      // Namespace detail renders as the Service Mesh tab of the console Project page.
      return `/k8s/cluster/projects/${namespace}/ossmconsole${query}`;
    }
    if (!name) {
      throw new Error(`Resource name is required for the "${type}" route: ${pathname}`);
    }
    switch (type) {
      case 'applications':
        return `/ossmconsole/applications/${namespace}/${name}${query}`;
      case 'istio': {
        // group/version/kind/name -> console resource reference group~version~kind/name
        const [group, version, kind, ...rest] = name.split('/');
        if (rest.length === 0) {
          throw new Error(`Invalid Istio detail path "${name}": expected group/version/kind/name`);
        }
        return `/k8s/ns/${namespace}/${group}~${version}~${kind}/${rest.join('/')}/ossmconsole${query}`;
      }
      case 'services': {
        // External services have no console /k8s resource page.
        const external = new URLSearchParams(search).get('type') === 'External' || name.includes('.');
        return external
          ? `/ossmconsole/services/${namespace}/${name}${query}`
          : `/k8s/ns/${namespace}/services/${name}/ossmconsole${query}`;
      }
      case 'workloads':
        return `/k8s/ns/${namespace}/deployments/${name}/ossmconsole${query}`;
      default:
        throw new Error(`Unknown namespace resource type "${type}": ${pathname}`);
    }
  }

  if (page === 'graph') {
    return (
      pathname
        .replace('/console/graph/node/namespaces', '/ossmconsole/graph/ns')
        .replace('/console/graph/namespaces', '/ossmconsole/graph') + query
    );
  }

  return `${pathname.replace('/console/', '/ossmconsole/')}${query}`;
}
