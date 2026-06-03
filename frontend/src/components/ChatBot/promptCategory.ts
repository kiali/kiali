export const derivePromptCategory = (pathname: string): string => {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'namespaces') {
    if (segments.length === 2) {
      return 'namespace-details';
    }
    if (segments.length >= 3) {
      switch (segments[2]) {
        case 'applications':
          return 'application-details';
        case 'services':
          return 'service-details';
        case 'workloads':
          return 'workload-details';
        case 'istio':
          return 'istio-details';
        default:
          return segments[2];
      }
    }
  }

  if (segments[0] === 'graph' && segments[1] === 'node') {
    return 'graph';
  }

  return segments[0] || 'overview';
};
