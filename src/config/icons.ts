import deepFreeze from 'deep-freeze';

const icons = {
  ISTIO: {
    MISSING_SIDECAR: { type: 'pf', name: 'blueprint', ascii: '\ue915 ', color: 'red' },
    VIRTUALSERVICE: { type: 'fa', name: 'code-fork', ascii: '\uf126 ' },
    CIRCUIT_BREAKER: { type: 'fa', name: 'bolt', ascii: '\uf0e7 ' }
  },
  MENU: {
    OVERVIEW: 'fa fa-tachometer',
    GRAPH: 'fa pficon-topology',
    APPLICATIONS: 'fa pficon-applications',
    WORKLOADS: 'fa pficon-bundle',
    SERVICES: 'fa pficon-service',
    ISTIO_CONFIG: 'fa pficon-template',
    DISTRIBUTED_TRACING: 'fa fa-paw'
  }
};

export const ICONS = () => {
  return deepFreeze(icons) as typeof icons;
};
