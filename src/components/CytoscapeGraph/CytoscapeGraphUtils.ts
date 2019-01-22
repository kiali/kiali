export const CyEdge = {
  grpc: 'grpc',
  grpcErr: 'grpcErr',
  grpcPercentErr: 'grpcPercentErr',
  grpcPercentReq: 'grpcPercentReq',
  http: 'http',
  http3xx: 'http3xx',
  http4xx: 'http4xx',
  http5xx: 'http5xx',
  httpPercentErr: 'httpPercentErr',
  httpPercentReq: 'httpPercentReq',
  id: 'id',
  isMTLS: 'isMTLS',
  isUnused: 'isUnused',
  responseTime: 'responseTime',
  tcp: 'tcp'
};

export const CyNode = {
  app: 'app',
  destServices: 'destServices',
  grpcIn: 'grpcIn',
  grpcInErr: 'grpcInErr',
  grpcOut: 'grpcOut',
  hasCB: 'hasCB',
  hasMissingSC: 'hasMissingSC',
  hasVS: 'hasVS',
  httpIn: 'httpIn',
  httpIn3xx: 'httpIn3xx',
  httpIn4xx: 'httpIn4xx',
  httpIn5xx: 'httpIn5xx',
  httpOut: 'httpOut',
  id: 'id',
  isDead: 'isDead',
  isGroup: 'isGroup',
  isInaccessible: 'isInaccessible',
  isMisconfigured: 'isMisconfigured',
  isOutside: 'isOutside',
  isRoot: 'isRoot',
  isServiceEntry: 'isServiceEntry',
  isUnused: 'isUnused',
  namespace: 'namespace',
  nodeType: 'nodeType',
  service: 'service',
  tcpIn: 'tcpIn',
  tcpOut: 'tcpOut',
  version: 'version',
  workload: 'workload'
};

export const ZoomOptions = {
  fitPadding: 25
};

export const safeFit = (cy: any) => {
  cy.fit('', ZoomOptions.fitPadding);
  if (cy.zoom() > 2.5) {
    cy.zoom(2.5);
    cy.center();
  }
};
