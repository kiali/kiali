export const buildPageContext = (
  kind: string | undefined,
  name: string | undefined,
  namespace: string | undefined,
  istio: string | undefined
): string | undefined => {
  if (!kind) {
    return undefined;
  }

  let context = '';

  if (!name) {
    switch (kind) {
      case 'mesh':
        context = 'User is seeing the mesh Graph';
        break;
      case 'graph':
        context = 'User is seeing the Traffic Graph';
        break;
      case 'workloads':
      case 'services':
      case 'applications':
      case 'namespaces':
        context = `User is seeing the List of ${kind}`;
        break;
      case 'istio':
        context = 'User is seeing the istio objects list';
        break;
      default:
        context = `User is seeing the ${kind} page`;
    }

    if (namespace) {
      context += ` for namespaces: ${namespace}`;
    }
  } else {
    if (kind === 'istio') {
      context = `User is seeing the istio object ${name} of namespace ${namespace} that is type ${istio || 'unknown'}`;
    } else {
      let kindStr = kind;
      if (kind === 'app' || kind === 'applications') kindStr = 'application';
      else if (kind === 'wk' || kind === 'workloads') kindStr = 'workload';
      else if (kind === 'srv' || kind === 'services') kindStr = 'service';
      else if (kind === 'namespace') kindStr = 'namespace';

      context = `User is seeing the information about ${kindStr} ${name} of namespace ${namespace}`;
    }
  }

  return context;
};
