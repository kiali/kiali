export const CyEdge = {
  http: 'http',
  http3XX: 'http3XX',
  http4XX: 'http4XX',
  http5XX: 'http5XX',
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
  hasCB: 'hasCB',
  hasMissingSC: 'hasMissingSC',
  hasVS: 'hasVS',
  httpIn: 'httpIn',
  httpIn3XX: 'httpIn3XX',
  httpIn4XX: 'httpIn4XX',
  httpIn5XX: 'httpIn5XX',
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
