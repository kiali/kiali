export function config() {
  return {
    version: '0.1',
    backend: {
      user: 'jdoe',
      password: 'password',
      endpoints: {
        Root: {
          path: '/api',
          method: 'get'
        },
        GetServices: {
          path: '/api/namespaces/<namespace_id>/services',
          method: 'get'
        },
        GetServiceMetrics: {
          path: '/api/namespaces/<namespace_id>/services/<service_id>/metrics',
          method: 'get'
        }
      }
    }
  };
}
