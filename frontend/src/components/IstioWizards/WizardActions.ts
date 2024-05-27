import { TLSStatus } from '../../types/TLSStatus';
import { getServicePort, WorkloadOverview } from '../../types/ServiceInfo';
import { WorkloadWeight } from './TrafficShifting';
import { Rule } from './RequestRouting/Rules';
import { K8sRule } from './K8sRequestRouting/K8sRules';
import {
  AuthorizationPolicy,
  AuthorizationPolicyRule,
  AuthorizationPolicyWorkloadSelector,
  Condition,
  ConnectionPoolSettings,
  DestinationRule,
  Gateway,
  HTTPMatchRequest,
  HTTPRoute,
  HTTPRouteDestination,
  IstioObject,
  K8sGateway,
  K8sHTTPHeaderFilter,
  K8sHTTPMatch,
  K8sHTTPRequestMirrorFilter,
  K8sHTTPRoute,
  K8sHTTPRouteFilter,
  K8sHTTPRouteMatch,
  K8sHTTPRouteRequestRedirect,
  K8sReferenceGrant,
  LoadBalancerSettings,
  Operation,
  OutlierDetection,
  PeerAuthentication,
  PeerAuthenticationMutualTLSMode,
  PeerAuthenticationWorkloadSelector,
  RequestAuthentication,
  RouteDestination,
  ServiceEntry,
  Sidecar,
  Source,
  StringMatch,
  TCPRoute,
  TLSRoute,
  VirtualService,
  WorkloadMatchSelector
} from '../../types/IstioObjects';
import { serverConfig } from '../../config';
import { GatewaySelectorState } from './GatewaySelector';
import { K8sGatewaySelectorState } from './K8sGatewaySelector';
import { ConsistentHashType, MUTUAL, TrafficPolicyState, UNSET } from './TrafficPolicy';
import { GatewayState } from '../../pages/IstioConfigNew/GatewayForm';
import { K8sGatewayState } from '../../pages/IstioConfigNew/K8sGatewayForm';
import { K8sReferenceGrantState } from '../../pages/IstioConfigNew/K8sReferenceGrantForm';
import { SidecarState } from '../../pages/IstioConfigNew/SidecarForm';
import { ALLOW, AuthorizationPolicyState } from '../../pages/IstioConfigNew/AuthorizationPolicyForm';
import { PeerAuthenticationState } from '../../pages/IstioConfigNew/PeerAuthenticationForm';
import { RequestAuthenticationState } from '../../pages/IstioConfigNew/RequestAuthenticationForm';
import { Workload } from '../../types/Workload';
import { FaultInjectionRoute } from './FaultInjection';
import { TimeoutRetryRoute } from './RequestTimeouts';
import { DestService, GraphDefinition, NodeType } from '../../types/Graph';
import { ServiceEntryState } from '../../pages/IstioConfigNew/ServiceEntryForm';
import { K8sRouteBackendRef } from './K8sTrafficShifting';
import { QUERY_PARAMS, PATH, HEADERS, METHOD } from './K8sRequestRouting/K8sMatchBuilder';
import { ServiceOverview } from '../../types/ServiceList';
import { ADD, SET, REQ_MOD, REQ_RED, REQ_MIR } from './K8sRequestRouting/K8sFilterBuilder';

export const WIZARD_TRAFFIC_SHIFTING = 'traffic_shifting';
export const WIZARD_TCP_TRAFFIC_SHIFTING = 'tcp_traffic_shifting';
export const WIZARD_REQUEST_ROUTING = 'request_routing';
export const WIZARD_FAULT_INJECTION = 'fault_injection';
export const WIZARD_REQUEST_TIMEOUTS = 'request_timeouts';

export const WIZARD_K8S_REQUEST_ROUTING = 'k8s_request_routing';
export const WIZARD_K8S_GRPC_REQUEST_ROUTING = 'k8s_grpc_request_routing';

export const WIZARD_ENABLE_AUTO_INJECTION = 'enable_auto_injection';
export const WIZARD_DISABLE_AUTO_INJECTION = 'disable_auto_injection';
export const WIZARD_REMOVE_AUTO_INJECTION = 'remove_auto_injection';
export const WIZARD_EDIT_ANNOTATIONS = 'edit_annotations';

export const SERVICE_WIZARD_ACTIONS = [
  WIZARD_REQUEST_ROUTING,
  WIZARD_FAULT_INJECTION,
  WIZARD_TRAFFIC_SHIFTING,
  WIZARD_TCP_TRAFFIC_SHIFTING,
  WIZARD_REQUEST_TIMEOUTS,
  WIZARD_K8S_REQUEST_ROUTING,
  WIZARD_K8S_GRPC_REQUEST_ROUTING
];

export type WizardAction =
  | 'request_routing'
  | 'fault_injection'
  | 'traffic_shifting'
  | 'tcp_traffic_shifting'
  | 'request_timeouts'
  | 'k8s_request_routing'
  | 'k8s_grpc_request_routing';
export type WizardMode = 'create' | 'update';

export const WIZARD_TITLES = {
  [WIZARD_REQUEST_ROUTING]: 'Request Routing',
  [WIZARD_FAULT_INJECTION]: 'Fault Injection',
  [WIZARD_TRAFFIC_SHIFTING]: 'Traffic Shifting',
  [WIZARD_TCP_TRAFFIC_SHIFTING]: 'TCP Traffic Shifting',
  [WIZARD_REQUEST_TIMEOUTS]: 'Request Timeouts',
  [WIZARD_K8S_REQUEST_ROUTING]: 'K8s HTTP Routing',
  [WIZARD_K8S_GRPC_REQUEST_ROUTING]: 'K8s GRPC Routing'
};

export type ServiceWizardProps = {
  cluster?: string;
  createOrUpdate: boolean;
  destinationRules: DestinationRule[];
  gateways: string[];
  istioAPIEnabled: boolean;
  k8sGateways: string[];
  k8sHTTPRoutes: K8sHTTPRoute[];
  namespace: string;
  onClose: (changed: boolean) => void;
  peerAuthentications: PeerAuthentication[];
  serviceName: string;
  servicePort?: number;
  show: boolean;
  subServices: ServiceOverview[];
  tlsStatus?: TLSStatus;
  type: string;
  update: boolean;
  virtualServices: VirtualService[];
  workloads: WorkloadOverview[];
};

export type ServiceWizardValid = {
  cp: boolean;
  gateway: boolean;
  k8sRouteHosts: boolean;
  lb: boolean;
  mainWizard: boolean;
  od: boolean;
  tls: boolean;
  vsHosts: boolean;
};

export type WizardPreviews = {
  dr?: DestinationRule;
  gw?: Gateway;
  k8sgateway?: K8sGateway;
  k8shttproute?: K8sHTTPRoute;
  pa?: PeerAuthentication;
  vs?: VirtualService;
};

export type ServiceWizardState = {
  advancedOptionsValid: boolean;
  advancedTabKey: number;
  confirmationModal: boolean;
  faultInjectionRoute: FaultInjectionRoute;
  gateway?: GatewaySelectorState;
  k8sGateway?: K8sGatewaySelectorState;
  k8sRouteHosts: string[];
  k8sRules: K8sRule[];
  previews?: WizardPreviews;
  rules: Rule[];
  showAdvanced: boolean;
  showPreview: boolean;
  showWizard: boolean;
  timeoutRetryRoute: TimeoutRetryRoute;
  trafficPolicy: TrafficPolicyState;
  valid: ServiceWizardValid;
  vsHosts: string[];
  workloads: WorkloadWeight[];
};

export type WorkloadWizardValid = {};

export type WorkloadWizardProps = {
  namespace: string;
  onClose: (changed: boolean) => void;
  show: boolean;
  type: string;
  workload: Workload;
};

export type WorkloadWizardState = {
  showWizard: boolean;
  valid: WorkloadWizardValid;
};

export const KIALI_WIZARD_LABEL = 'kiali_wizard';
export const KIALI_RELATED_LABEL = 'kiali_wizard_related';

// Wizard don't operate with EnvoyFilters so they can use the v1 version
export const ISTIO_NETWORKING_VERSION = 'networking.istio.io/v1';
export const ISTIO_SECURITY_VERSION = 'security.istio.io/v1';
export const GATEWAY_NETWORKING_VERSION = 'gateway.networking.k8s.io/v1';

export const fqdnServiceName = (serviceName: string, namespace: string): string => {
  return `${serviceName}.${namespace}.${serverConfig.istioIdentityDomain}`;
};

const buildHTTPMatchRequest = (matches: string[]): HTTPMatchRequest[] => {
  const matchRequests: HTTPMatchRequest[] = [];
  const matchHeaders: HTTPMatchRequest = { headers: {} };
  // Headers are grouped
  matches
    .filter(match => match.startsWith('headers'))
    .forEach(match => {
      // match follows format:  headers [<header-name>] <op> <value>
      const i0 = match.indexOf('[');
      const j0 = match.indexOf(']');
      const headerName = match.substring(i0 + 1, j0).trim();
      const i1 = match.indexOf(' ', j0 + 1);
      const j1 = match.indexOf(' ', i1 + 1);
      const op = match.substring(i1 + 1, j1).trim();
      const value = match.substring(j1 + 1).trim();
      matchHeaders.headers![headerName] = { [op]: value };
    });
  if (Object.keys(matchHeaders.headers || {}).length > 0) {
    matchRequests.push(matchHeaders);
  }
  // Rest of matches
  matches
    .filter(match => !match.startsWith('headers'))
    .forEach(match => {
      // match follows format: <name> <op> <value>
      const i = match.indexOf(' ');
      const j = match.indexOf(' ', i + 1);
      const name = match.substring(0, i).trim();
      const op = match.substring(i + 1, j).trim();
      const value = match.substring(j + 1).trim();
      matchRequests.push({
        [name]: {
          [op]: value
        }
      });
    });
  return matchRequests;
};

const buildK8sHTTPRouteMatch = (matches: string[]): K8sHTTPRouteMatch => {
  const matchRoute: K8sHTTPRouteMatch = {};
  const matchHeaders: K8sHTTPMatch[] = [];
  const matchQueries: K8sHTTPMatch[] = [];
  let matchPath = {};
  let matchMethod = '';

  matches
    .filter(match => match.startsWith(HEADERS))
    .forEach(match => {
      // match follows format:  headers [<header-name>] <op> <value>
      const i0 = match.indexOf('[');
      const j0 = match.indexOf(']');
      const headerName = match.substring(i0 + 1, j0).trim();
      const i1 = match.indexOf(' ', j0 + 1);
      const j1 = match.indexOf(' ', i1 + 1);
      const op = match.substring(i1 + 1, j1).trim();
      const value = match.substring(j1 + 1).trim();
      matchHeaders.push({
        name: headerName,
        type: op,
        value: value
      });
    });
  // Path
  matches
    .filter(match => match.startsWith(PATH))
    .forEach(match => {
      // match follows format: <op> <value>
      const i = match.indexOf(' ');
      const j = match.indexOf(' ', i + 1);
      const op = match.substring(i + 1, j).trim();
      const value = match.substring(j + 1).trim();
      // Only one Path per Match
      matchPath = { type: op, value: value };
    });
  // QueryParams
  matches
    .filter(match => match.startsWith(QUERY_PARAMS))
    .forEach(match => {
      // match follows format: <name> <op> <value>
      const i = match.indexOf(' ');
      const j = match.indexOf(' ', i + 1);
      const k = match.indexOf(' ', j + 1);
      const name = match.substring(i, j).trim();
      const op = match.substring(j + 1, k).trim();
      const value = match.substring(k + 1).trim();
      matchQueries.push({ name: name, type: op, value: value });
    });
  // Method
  matches
    .filter(match => match.startsWith(METHOD))
    .forEach(match => {
      // match follows format: <name> <op> <value>
      const i = match.indexOf(' ');
      const value = match.substring(i).trim();
      // Only one method per Match
      matchMethod = value;
    });
  if (matchHeaders.length > 0) {
    matchRoute.headers = matchHeaders;
  }
  if (matchQueries.length > 0) {
    matchRoute.queryParams = matchQueries;
  }
  if (matchPath) {
    matchRoute.path = matchPath;
  }
  if (matchMethod) {
    matchRoute.method = matchMethod;
  }
  return matchRoute;
};

const buildK8sHTTPRouteFilter = (filters: string[]): K8sHTTPRouteFilter[] => {
  const routeFilter: K8sHTTPRouteFilter[] = [];
  filters
    .filter(filter => filter.startsWith(REQ_MOD))
    .forEach(filter => {
      const requestHeaderModifier: K8sHTTPHeaderFilter = {};
      // match follows format:  requestHeaderModifier [<header-name>] <add/set/remove> <value/null>
      const i0 = filter.indexOf('[');
      const j0 = filter.indexOf(']');
      const filterType = filter.substring(0, i0 - 1).trim();
      const headerName = filter.substring(i0 + 1, j0).trim();
      const i1 = filter.indexOf(' ', j0 + 1);
      const j1 = filter.indexOf(' ', i1 + 1);
      const op = filter.substring(i1 + 1, j1).trim();
      const value = filter.substring(j1 + 1).trim();
      let removeHeader: string = headerName;
      if (filterType === REQ_MOD && ((headerName && value) || removeHeader)) {
        if (op === ADD) {
          if (!requestHeaderModifier.add) {
            requestHeaderModifier.add = [];
          }
          requestHeaderModifier.add.push({ name: headerName, value: value });
        } else if (op === SET) {
          if (!requestHeaderModifier.set) {
            requestHeaderModifier.set = [];
          }
          requestHeaderModifier.set.push({ name: headerName, value: value });
        } else {
          if (!requestHeaderModifier.remove) {
            requestHeaderModifier.remove = [];
          }
          requestHeaderModifier.remove.push(removeHeader);
        }
      }

      routeFilter.push({ type: 'RequestHeaderModifier', requestHeaderModifier: requestHeaderModifier });
    });

  filters
    .filter(filter => filter.startsWith(REQ_RED))
    .forEach(filter => {
      const requestRedirect: K8sHTTPRouteRequestRedirect = {};
      // match follows format:  requestRedirect protocol://hostname:port returnCode>
      const i0 = filter.indexOf(' ');
      const j0 = filter.indexOf(':');
      const protocol = filter.substring(i0 + 1, j0).trim();
      const j1 = filter.indexOf(':', j0 + 1);
      const hostname = filter.substring(j0 + 3, j1).trim();
      const j2 = filter.indexOf(' ', j1);
      const port = filter.substring(j1 + 1, j2).trim();
      const code = parseInt(filter.substring(j2 + 1).trim());
      requestRedirect.scheme = protocol;
      if (hostname) {
        requestRedirect.hostname = hostname;
      }
      if (port) {
        requestRedirect.port = parseInt(port);
      }
      requestRedirect.statusCode = code;
      routeFilter.push({ type: 'RequestRedirect', requestRedirect: requestRedirect });
    });

  filters
    .filter(filter => filter.startsWith(REQ_MIR))
    .forEach(filter => {
      const requestMirror: K8sHTTPRequestMirrorFilter = {};
      // match follows format:  requestMirror service:port
      const i0 = filter.indexOf(' ');
      const j0 = filter.indexOf(':');
      const service = filter.substring(i0 + 1, j0).trim();
      const port = filter.substring(j0 + 1).trim();
      if (service && port) {
        requestMirror.backendRef = { name: service, port: parseInt(port) };
      }
      routeFilter.push({ type: 'RequestMirror', requestMirror: requestMirror });
    });

  return routeFilter;
};

const parseStringMatch = (value: StringMatch): string => {
  if (value.exact) {
    return `exact ${value.exact}`;
  }
  if (value.prefix) {
    return `prefix ${value.prefix}`;
  }
  if (value.regex) {
    return `regex ${value.regex}`;
  }
  return '';
};

const parseHttpMatchRequest = (httpMatchRequest: HTTPMatchRequest): string[] => {
  const matches: string[] = [];
  // Headers
  if (httpMatchRequest.headers) {
    Object.keys(httpMatchRequest.headers).forEach(headerName => {
      const value = httpMatchRequest.headers![headerName];
      matches.push(`headers [${headerName}] ${parseStringMatch(value)}`);
    });
  }
  if (httpMatchRequest.uri) {
    matches.push(`uri ${parseStringMatch(httpMatchRequest.uri)}`);
  }
  if (httpMatchRequest.scheme) {
    matches.push(`scheme ${parseStringMatch(httpMatchRequest.scheme)}`);
  }
  if (httpMatchRequest.method) {
    matches.push(`method ${parseStringMatch(httpMatchRequest.method)}`);
  }
  if (httpMatchRequest.authority) {
    matches.push(`authority ${parseStringMatch(httpMatchRequest.authority)}`);
  }
  return matches;
};

const parseK8sHTTPMatchRequest = (httpRouteMatch: K8sHTTPRouteMatch): string[] => {
  const matches: string[] = [];
  if (httpRouteMatch.path) {
    matches.push(`path ${httpRouteMatch.path?.type} ${httpRouteMatch.path?.value}`);
  }
  // Headers
  if (httpRouteMatch.headers) {
    httpRouteMatch.headers.forEach(header => {
      matches.push(`headers [${header.name}] ${header.type} ${header.value}`);
    });
  }
  if (httpRouteMatch.queryParams) {
    httpRouteMatch.queryParams.forEach(qp => {
      matches.push(`queryParam ${qp.name} ${qp.type} ${qp.value}`);
    });
  }
  if (httpRouteMatch.method) {
    matches.push(`method ${httpRouteMatch.method}`);
  }

  return matches;
};

const parseK8sHTTPRouteFilter = (httpRouteFilter: K8sHTTPRouteFilter): string[] => {
  let matches: string[] = [];
  if (httpRouteFilter.requestHeaderModifier) {
    matches = matches.concat(parseK8sHTTPHeaderFilter('requestHeaderModifier', httpRouteFilter.requestHeaderModifier));
  }
  if (httpRouteFilter.requestRedirect) {
    matches = matches.concat(parseK8sHTTPRouteRequestRedirect(httpRouteFilter.requestRedirect));
  }
  if (httpRouteFilter.requestMirror) {
    matches = matches.concat(parseK8sHTTPRouteRequestMirror(httpRouteFilter.requestMirror));
  }
  return matches;
};

const parseK8sHTTPHeaderFilter = (filterType: string, httpHeaderFilter: K8sHTTPHeaderFilter): string[] => {
  const filters: string[] = [];
  if (httpHeaderFilter.set) {
    httpHeaderFilter.set.forEach(set => {
      filters.push(`${filterType} [${set.name}] set ${set.value}`);
    });
  }
  if (httpHeaderFilter.add) {
    httpHeaderFilter.add.forEach(add => {
      filters.push(`${filterType} [${add.name}] add ${add.value}`);
    });
  }
  if (httpHeaderFilter.remove) {
    httpHeaderFilter.remove.forEach(rm => {
      filters.push(`${filterType} [${rm}] remove`);
    });
  }
  return filters;
};

const parseK8sHTTPRouteRequestRedirect = (requestRedirect: K8sHTTPRouteRequestRedirect): string => {
  return `${REQ_RED} ${requestRedirect.scheme}://${requestRedirect.hostname ? requestRedirect.hostname : ''}:${
    requestRedirect.port ? requestRedirect.port : ''
  } ${requestRedirect.statusCode}`;
};

const parseK8sHTTPRouteRequestMirror = (requestMirror: K8sHTTPRequestMirrorFilter): string => {
  return `${REQ_MIR} ${`${
    requestMirror.backendRef ? `${requestMirror.backendRef.name}:${requestMirror.backendRef.port}` : ''
  }`}`;
};

export const getGatewayName = (namespace: string, serviceName: string, gatewayNames: string[]): string => {
  let gatewayName = `${namespace}/${serviceName}-gateway`;
  if (gatewayNames.length === 0) {
    return gatewayName;
  }
  let goodName = false;
  while (!goodName) {
    if (!gatewayNames.includes(gatewayName)) {
      goodName = true;
    } else {
      // Iterate until we find a good gatewayName
      if (gatewayName.charAt(gatewayName.length - 2) === '-') {
        let version = +gatewayName.charAt(gatewayName.length - 1);
        version = version + 1;
        gatewayName = gatewayName.substr(0, gatewayName.length - 1) + version;
      } else {
        gatewayName = `${gatewayName}-1`;
      }
    }
  }
  return gatewayName;
};

export const buildIstioConfig = (wProps: ServiceWizardProps, wState: ServiceWizardState): WizardPreviews => {
  const wkdNameVersion: { [key: string]: string } = {};

  // DestinationRule from the labels
  let drName = wProps.serviceName;
  // In some limited scenarios DR may be created externally to Kiali (i.e. extensions)
  if (wProps.destinationRules.length === 1 && wProps.destinationRules[0].metadata.name !== drName) {
    drName = wProps.destinationRules[0].metadata.name;
  }
  let wizardK8sHTTPRoute: K8sHTTPRoute | undefined = undefined;
  let wizardDR: DestinationRule | undefined = undefined;
  let wizardVS: VirtualService | undefined = undefined;
  let wizardGW: Gateway | undefined;
  let wizardK8sGW: K8sGateway | undefined;
  let wizardPA: PeerAuthentication | undefined = undefined;
  const fullNewGatewayName = getGatewayName(
    wProps.namespace,
    wProps.serviceName,
    wProps.gateways.concat(wProps.k8sGateways)
  );

  if (wProps.type !== WIZARD_K8S_REQUEST_ROUTING && wProps.type !== WIZARD_K8S_GRPC_REQUEST_ROUTING) {
    wizardDR = {
      kind: 'DestinationRule',
      apiVersion: ISTIO_NETWORKING_VERSION,
      metadata: {
        namespace: wProps.namespace,
        name: drName,
        labels: {
          [KIALI_WIZARD_LABEL]: wProps.type
        }
      },
      spec: {
        host: fqdnServiceName(wProps.serviceName, wProps.namespace)
      }
    };

    const subsets = wProps.workloads
      .filter(workload => {
        // Filter out workloads without version label
        const versionLabelName = serverConfig.istioLabels.versionLabelName;
        return workload.labels![versionLabelName];
      })
      .map(workload => {
        // Using version
        const versionLabelName = serverConfig.istioLabels.versionLabelName;
        const versionValue = workload.labels![versionLabelName];
        const labels: { [key: string]: string } = {};
        labels[versionLabelName] = versionValue;
        // Populate helper table workloadName -> version
        wkdNameVersion[workload.name] = versionValue;
        return {
          name: versionValue,
          labels: labels
        };
      });

    if (subsets.length > 0) {
      wizardDR.spec.subsets = subsets;
    }

    // In some limited scenarios VS may be created externally to Kiali (i.e. extensions)
    let vsName = wProps.serviceName;
    if (wProps.virtualServices.length === 1 && wProps.virtualServices[0].metadata.name !== vsName) {
      vsName = wProps.virtualServices[0].metadata.name;
    }
    wizardVS = {
      kind: 'VirtualService',
      apiVersion: ISTIO_NETWORKING_VERSION,
      metadata: {
        namespace: wProps.namespace,
        name: vsName,
        labels: {
          [KIALI_WIZARD_LABEL]: wProps.type
        }
      },
      spec: {}
    };

    // Wizard is optional, only when user has explicitly selected "Create a Gateway or K8s API Gateway"
    wizardGW =
      wState.gateway && wState.gateway.addGateway && wState.gateway.newGateway
        ? {
            kind: 'Gateway',
            apiVersion: ISTIO_NETWORKING_VERSION,
            metadata: {
              namespace: wProps.namespace,
              name: fullNewGatewayName.substr(wProps.namespace.length + 1),
              labels: {
                [KIALI_WIZARD_LABEL]: wProps.type
              }
            },
            spec: {
              selector: {
                istio: 'ingressgateway'
              },
              servers: [
                {
                  port: {
                    number: wState.gateway.port,
                    name: 'http',
                    protocol: 'HTTP'
                  },
                  hosts: wState.gateway.gwHosts.split(',')
                }
              ]
            }
          }
        : undefined;

    switch (wProps.type) {
      case WIZARD_TRAFFIC_SHIFTING: {
        // VirtualService from the weights
        wizardVS.spec = {
          http: [
            {
              route: wState.workloads
                .filter(workload => !workload.mirrored)
                .map(workload => {
                  const httpRouteDestination: HTTPRouteDestination = {
                    destination: {
                      host: fqdnServiceName(wProps.serviceName, wProps.namespace)
                    },
                    weight: workload.weight
                  };
                  if (wkdNameVersion[workload.name]) {
                    httpRouteDestination.destination.subset = wkdNameVersion[workload.name];
                  }
                  return httpRouteDestination;
                })
            }
          ]
        };
        // Update HTTP Route with mirror destination + percentage
        const mirrorWorkload = wState.workloads.filter(workload => workload.mirrored).pop();
        if (mirrorWorkload && wizardVS?.spec?.http?.length === 1) {
          wizardVS.spec.http[0].mirror = {
            host: fqdnServiceName(wProps.serviceName, wProps.namespace)
          };
          if (wkdNameVersion[mirrorWorkload.name]) {
            wizardVS.spec.http[0].mirror.subset = wkdNameVersion[mirrorWorkload.name];
          }
          wizardVS.spec.http[0].mirrorPercentage = {
            value: mirrorWorkload.weight
          };
        }
        break;
      }
      case WIZARD_TCP_TRAFFIC_SHIFTING: {
        // VirtualService from the weights
        wizardVS.spec = {
          tcp: [
            {
              route: wState.workloads.map(workload => {
                const routeDestination: RouteDestination = {
                  destination: {
                    host: fqdnServiceName(wProps.serviceName, wProps.namespace)
                  },
                  weight: workload.weight
                };
                if (wkdNameVersion[workload.name]) {
                  routeDestination.destination.subset = wkdNameVersion[workload.name];
                }
                return routeDestination;
              })
            }
          ]
        };
        break;
      }
      case WIZARD_REQUEST_ROUTING: {
        // VirtualService from the routes
        wizardVS.spec = {
          http: wState.rules.map(rule => {
            const httpRoute: HTTPRoute = {};
            httpRoute.route = [];
            rule.workloadWeights
              .filter(workload => !workload.mirrored)
              .forEach(workload => {
                const destW: HTTPRouteDestination = {
                  destination: {
                    host: fqdnServiceName(wProps.serviceName, wProps.namespace)
                  },
                  weight: workload.weight
                };
                if (wkdNameVersion[workload.name]) {
                  destW.destination.subset = wkdNameVersion[workload.name];
                }
                httpRoute.route?.push(destW);
              });

            const mirrorWorkload = rule.workloadWeights.filter(workload => workload.mirrored).pop();
            if (mirrorWorkload) {
              httpRoute.mirror = {
                host: fqdnServiceName(wProps.serviceName, wProps.namespace)
              };
              if (wkdNameVersion[mirrorWorkload.name]) {
                httpRoute.mirror.subset = wkdNameVersion[mirrorWorkload.name];
              }
              httpRoute.mirrorPercentage = {
                value: mirrorWorkload.weight
              };
            }

            if (rule.matches.length > 0) {
              httpRoute.match = buildHTTPMatchRequest(rule.matches);
            }

            if (rule.delay || rule.abort) {
              httpRoute.fault = {};
              if (rule.delay) {
                httpRoute.fault.delay = rule.delay;
              }
              if (rule.abort) {
                httpRoute.fault.abort = rule.abort;
              }
            }
            if (rule.timeout) {
              httpRoute.timeout = rule.timeout;
            }
            if (rule.retries) {
              httpRoute.retries = rule.retries;
            }
            return httpRoute;
          })
        };
        break;
      }
      case WIZARD_FAULT_INJECTION: {
        // VirtualService from the weights mapped in the FaultInjectionRoute
        wizardVS.spec = {
          http: [
            {
              route: wState.faultInjectionRoute.workloads.map(workload => {
                const httpRouteDestination: HTTPRouteDestination = {
                  destination: {
                    host: fqdnServiceName(wProps.serviceName, wProps.namespace)
                  },
                  weight: workload.weight
                };
                if (wkdNameVersion[workload.name]) {
                  httpRouteDestination.destination.subset = wkdNameVersion[workload.name];
                }
                return httpRouteDestination;
              })
            }
          ]
        };
        if (wizardVS.spec.http && wizardVS.spec.http[0]) {
          if (wState.faultInjectionRoute.delayed || wState.faultInjectionRoute.aborted) {
            wizardVS.spec.http[0].fault = {};
            if (wState.faultInjectionRoute.delayed) {
              wizardVS.spec.http[0].fault.delay = wState.faultInjectionRoute.delay;
            }
            if (wState.faultInjectionRoute.aborted) {
              wizardVS.spec.http[0].fault.abort = wState.faultInjectionRoute.abort;
            }
          }
        }
        break;
      }
      case WIZARD_REQUEST_TIMEOUTS: {
        // VirtualService from the weights mapped in the TimeoutRetryRoute
        wizardVS.spec = {
          http: [
            {
              route: wState.timeoutRetryRoute.workloads.map(workload => {
                const httpRouteDestination: HTTPRouteDestination = {
                  destination: {
                    host: fqdnServiceName(wProps.serviceName, wProps.namespace),
                    subset: wkdNameVersion[workload.name]
                  },
                  weight: workload.weight
                };
                if (wkdNameVersion[workload.name]) {
                  httpRouteDestination.destination.subset = wkdNameVersion[workload.name];
                }
                return httpRouteDestination;
              })
            }
          ]
        };
        if (wizardVS.spec.http && wizardVS.spec.http[0]) {
          if (wState.timeoutRetryRoute.isTimeout) {
            wizardVS.spec.http[0].timeout = wState.timeoutRetryRoute.timeout;
          }
          if (wState.timeoutRetryRoute.isRetry) {
            wizardVS.spec.http[0].retries = wState.timeoutRetryRoute.retries;
          }
        }
        break;
      }
      default:
        console.warn(`WizardActions: Unrecognized type [${wProps.type}]`);
    }

    wizardVS.spec.hosts =
      wState.vsHosts.length > 1 || (wState.vsHosts.length === 1 && wState.vsHosts[0].length > 0)
        ? wState.vsHosts
        : [wProps.serviceName];

    if (wState.trafficPolicy.tlsModified && wState.trafficPolicy.mtlsMode !== UNSET) {
      wizardDR.spec.trafficPolicy = {};
      wizardDR.spec.trafficPolicy.tls = {
        mode: wState.trafficPolicy.mtlsMode,
        clientCertificate: null,
        privateKey: null,
        caCertificates: null
      };
      if (wState.trafficPolicy.mtlsMode === MUTUAL) {
        wizardDR.spec.trafficPolicy.tls.clientCertificate = wState.trafficPolicy.clientCertificate;
        wizardDR.spec.trafficPolicy.tls.privateKey = wState.trafficPolicy.privateKey;
        wizardDR.spec.trafficPolicy.tls.caCertificates = wState.trafficPolicy.caCertificates;
      }
    }

    if (wState.trafficPolicy.peerAuthnSelector.addPeerAuthentication) {
      const peerAuthnLabels: { [key: string]: string } = {};
      peerAuthnLabels[serverConfig.istioLabels.appLabelName] = wProps.workloads[0].labels![
        serverConfig.istioLabels.appLabelName
      ];

      wizardPA = {
        apiVersion: ISTIO_SECURITY_VERSION,
        kind: 'PeerAuthentication',
        metadata: {
          namespace: wProps.namespace,
          name: wProps.serviceName,
          labels: {
            [KIALI_WIZARD_LABEL]: wProps.type
          }
        },
        spec: {
          selector: {
            matchLabels: peerAuthnLabels
          },
          mtls: {
            mode: wState.trafficPolicy.peerAuthnSelector.mode
          }
        }
      };

      wizardDR.metadata.annotations = {};
      wizardDR.metadata.annotations[KIALI_RELATED_LABEL] = `PeerAuthentication/${wProps.serviceName}`;
    }

    if (wState.trafficPolicy.addLoadBalancer) {
      if (!wizardDR.spec.trafficPolicy) {
        wizardDR.spec.trafficPolicy = {};
      }

      if (wState.trafficPolicy.simpleLB) {
        // Remember to put a null fields that need to be deleted on a JSON merge patch
        wizardDR.spec.trafficPolicy.loadBalancer = {
          simple: wState.trafficPolicy.loadBalancer.simple,
          consistentHash: null
        };
      } else {
        wizardDR.spec.trafficPolicy.loadBalancer = {
          simple: null,
          consistentHash: {}
        };
        wizardDR.spec.trafficPolicy.loadBalancer.consistentHash = {
          httpHeaderName: null,
          httpCookie: null,
          useSourceIp: null
        };
        if (wState.trafficPolicy.loadBalancer.consistentHash) {
          const consistentHash = wState.trafficPolicy.loadBalancer.consistentHash;
          switch (wState.trafficPolicy.consistentHashType) {
            case ConsistentHashType.HTTP_HEADER_NAME:
              wizardDR.spec.trafficPolicy.loadBalancer.consistentHash.httpHeaderName = consistentHash.httpHeaderName;
              break;
            case ConsistentHashType.HTTP_COOKIE:
              wizardDR.spec.trafficPolicy.loadBalancer.consistentHash.httpCookie = consistentHash.httpCookie;
              break;
            case ConsistentHashType.USE_SOURCE_IP:
              wizardDR.spec.trafficPolicy.loadBalancer.consistentHash.useSourceIp = true;
              break;
            default:
            /// No default action
          }
        }
      }
    }

    if (wState.trafficPolicy.addConnectionPool) {
      if (!wizardDR.spec.trafficPolicy) {
        wizardDR.spec.trafficPolicy = {};
      }
      wizardDR.spec.trafficPolicy.connectionPool = wState.trafficPolicy.connectionPool;
    }

    if (wState.trafficPolicy.addOutlierDetection) {
      if (!wizardDR.spec.trafficPolicy) {
        wizardDR.spec.trafficPolicy = {};
      }
      wizardDR.spec.trafficPolicy.outlierDetection = wState.trafficPolicy.outlierDetection;
    }

    // If traffic policy has empty objects, it will be invalidated because galleys expects at least one non-empty field.
    if (!wizardDR.spec.trafficPolicy) {
      wizardDR.spec.trafficPolicy = null;
    }

    // If there isn't any PeerAuthn created/updated, remove the DR annotation
    if (!wizardPA) {
      // @ts-ignore
      wizardDR.metadata.annotations = null;
    }

    if (wState.gateway && wState.gateway.addGateway) {
      wizardVS.spec.gateways = [];
      if (wState.gateway.newGateway) {
        wizardVS.spec.gateways.push(fullNewGatewayName);
      } else if (wState.gateway.selectedGateway.length > 0) {
        wizardVS.spec.gateways.push(wState.gateway.selectedGateway);
      }
      if (wState.gateway.addMesh && !wizardVS.spec.gateways.includes('mesh')) {
        wizardVS.spec.gateways.push('mesh');
      }
      // Don't leave empty gateways
      if (wizardVS.spec.gateways.length === 0) {
        wizardVS.spec.gateways = null;
      }
    } else {
      wizardVS.spec.gateways = null;
    }
  }
  if (wProps.type === WIZARD_K8S_REQUEST_ROUTING) {
    let k8sRouteName = wProps.serviceName;
    if (
      wProps.k8sHTTPRoutes &&
      wProps.k8sHTTPRoutes.length === 1 &&
      wProps.k8sHTTPRoutes[0].metadata.name !== k8sRouteName
    ) {
      k8sRouteName = wProps.k8sHTTPRoutes[0].metadata.name;
    }

    wizardK8sGW =
      wState.k8sGateway && wState.k8sGateway.addGateway && wState.k8sGateway.newGateway
        ? {
            kind: 'Gateway',
            apiVersion: GATEWAY_NETWORKING_VERSION,
            metadata: {
              namespace: wProps.namespace,
              name: fullNewGatewayName.substr(wProps.namespace.length + 1),
              labels: {
                [KIALI_WIZARD_LABEL]: wProps.type,
                app: fullNewGatewayName.substr(wProps.namespace.length + 1)
              }
            },
            spec: {
              gatewayClassName: wState.k8sGateway.gatewayClass,
              listeners: [
                {
                  name: 'default',
                  // here gwHosts for K8s API Gateway contains single host
                  hostname: wState.k8sGateway.gwHosts,
                  port: wState.k8sGateway.port,
                  protocol: 'HTTP',
                  allowedRoutes: {
                    namespaces: {
                      from: 'All',
                      selector: {
                        matchLabels: {}
                      }
                    }
                  }
                }
              ]
            }
          }
        : undefined;

    wizardK8sHTTPRoute = {
      kind: 'HTTPRoute',
      apiVersion: GATEWAY_NETWORKING_VERSION,
      metadata: {
        namespace: wProps.namespace,
        name: k8sRouteName,
        labels: {
          [KIALI_WIZARD_LABEL]: wProps.type
        }
      },
      spec: {}
    };
    wizardK8sHTTPRoute.spec.hostnames =
      wState.k8sRouteHosts.length > 1 || (wState.k8sRouteHosts.length === 1 && wState.k8sRouteHosts[0].length > 0)
        ? wState.k8sRouteHosts
        : [wProps.serviceName];
    switch (wProps.type) {
      case WIZARD_K8S_REQUEST_ROUTING: {
        // parentRefs to K8sGateway
        if (wState.k8sGateway && wState.k8sGateway.addGateway) {
          wizardK8sHTTPRoute.spec.parentRefs = [];
          if (wState.k8sGateway.newGateway) {
            const namespaceAndName = fullNewGatewayName.split('/');
            const gwNamespace = namespaceAndName[0];
            const gwName = namespaceAndName[1];
            wizardK8sHTTPRoute.spec.parentRefs.push({
              name: gwName,
              namespace: gwNamespace
            });
          } else if (wState.k8sGateway.selectedGateway.length > 0) {
            const namespaceAndName = wState.k8sGateway.selectedGateway.split('/');
            const gwNamespace = namespaceAndName[0];
            const gwName = namespaceAndName[1];
            wizardK8sHTTPRoute.spec.parentRefs.push({
              name: gwName,
              namespace: gwNamespace
            });
          }
        }
        if (wState.k8sRules && wState.k8sRules.length > 0) {
          wizardK8sHTTPRoute.spec.rules = [];
          wState.k8sRules.forEach(rule => {
            if (rule.matches.length > 0 || rule.filters.length > 0) {
              wizardK8sHTTPRoute!.spec!.rules!.push({
                matches: [buildK8sHTTPRouteMatch(rule.matches)],
                filters: buildK8sHTTPRouteFilter(rule.filters),
                backendRefs: rule.backendRefs
              });
            } else {
              wizardK8sHTTPRoute!.spec!.rules!.push({
                backendRefs: rule.backendRefs
              });
            }
          });
        }
        break;
      }
    }
  }
  if (wProps.type === WIZARD_K8S_GRPC_REQUEST_ROUTING) {
    let k8sRouteName = wProps.serviceName;
    if (
      wProps.k8sHTTPRoutes &&
      wProps.k8sHTTPRoutes.length === 1 &&
      wProps.k8sHTTPRoutes[0].metadata.name !== k8sRouteName
    ) {
      k8sRouteName = wProps.k8sHTTPRoutes[0].metadata.name;
    }

    wizardK8sGW =
      wState.k8sGateway && wState.k8sGateway.addGateway && wState.k8sGateway.newGateway
        ? {
            kind: 'Gateway',
            apiVersion: GATEWAY_NETWORKING_VERSION,
            metadata: {
              namespace: wProps.namespace,
              name: fullNewGatewayName.substr(wProps.namespace.length + 1),
              labels: {
                [KIALI_WIZARD_LABEL]: wProps.type,
                app: fullNewGatewayName.substr(wProps.namespace.length + 1)
              }
            },
            spec: {
              gatewayClassName: wState.k8sGateway.gatewayClass,
              listeners: [
                {
                  name: 'default',
                  // here gwHosts for K8s API Gateway contains single host
                  hostname: wState.k8sGateway.gwHosts,
                  port: wState.k8sGateway.port,
                  protocol: 'HTTP',
                  allowedRoutes: {
                    namespaces: {
                      from: 'All',
                      selector: {
                        matchLabels: {}
                      }
                    }
                  }
                }
              ]
            }
          }
        : undefined;

    wizardK8sHTTPRoute = {
      kind: 'HTTPRoute',
      apiVersion: GATEWAY_NETWORKING_VERSION,
      metadata: {
        namespace: wProps.namespace,
        name: k8sRouteName,
        labels: {
          [KIALI_WIZARD_LABEL]: wProps.type
        }
      },
      spec: {}
    };
    wizardK8sHTTPRoute.spec.hostnames =
      wState.k8sRouteHosts.length > 1 || (wState.k8sRouteHosts.length === 1 && wState.k8sRouteHosts[0].length > 0)
        ? wState.k8sRouteHosts
        : [wProps.serviceName];
    switch (wProps.type) {
      case WIZARD_K8S_GRPC_REQUEST_ROUTING: {
        // parentRefs to K8sGateway
        if (wState.k8sGateway && wState.k8sGateway.addGateway) {
          wizardK8sHTTPRoute.spec.parentRefs = [];
          if (wState.k8sGateway.newGateway) {
            const namespaceAndName = fullNewGatewayName.split('/');
            const gwNamespace = namespaceAndName[0];
            const gwName = namespaceAndName[1];
            wizardK8sHTTPRoute.spec.parentRefs.push({
              name: gwName,
              namespace: gwNamespace
            });
          } else if (wState.k8sGateway.selectedGateway.length > 0) {
            const namespaceAndName = wState.k8sGateway.selectedGateway.split('/');
            const gwNamespace = namespaceAndName[0];
            const gwName = namespaceAndName[1];
            wizardK8sHTTPRoute.spec.parentRefs.push({
              name: gwName,
              namespace: gwNamespace
            });
          }
        }
        if (wState.k8sRules && wState.k8sRules.length > 0) {
          wizardK8sHTTPRoute.spec.rules = [];
          wState.k8sRules.forEach(rule => {
            if (rule.matches.length > 0 || rule.filters.length > 0) {
              wizardK8sHTTPRoute!.spec!.rules!.push({
                matches: [buildK8sHTTPRouteMatch(rule.matches)],
                filters: buildK8sHTTPRouteFilter(rule.filters),
                backendRefs: rule.backendRefs
              });
            } else {
              wizardK8sHTTPRoute!.spec!.rules!.push({
                backendRefs: rule.backendRefs
              });
            }
          });
        }
        break;
      }
    }
  }
  return {
    dr: wizardDR,
    vs: wizardVS,
    gw: wizardGW,
    k8sgateway: wizardK8sGW,
    pa: wizardPA,
    k8shttproute: wizardK8sHTTPRoute
  };
};

const getWorkloadsByVersion = (
  workloads: WorkloadOverview[],
  destinationRules: DestinationRule[]
): { [key: string]: string } => {
  const versionLabelName = serverConfig.istioLabels.versionLabelName;
  const wkdVersionName: { [key: string]: string } = {};
  workloads.forEach(workload => (wkdVersionName[workload.labels![versionLabelName]] = workload.name));
  if (destinationRules.length > 0) {
    destinationRules.forEach(dr => {
      dr.spec.subsets?.forEach(ss => {
        const version = ss.labels![versionLabelName];
        wkdVersionName[ss.name] = wkdVersionName[version];
      });
    });
  }
  return wkdVersionName;
};

export const getDefaultBackendRefs = (subServices: ServiceOverview[]): K8sRouteBackendRef[] => {
  const sTraffic = subServices.length < 100 ? Math.floor(100 / subServices.length) : 0;
  const remainTraffic = subServices.length < 100 ? 100 % subServices.length : 0;
  const backendRefs: K8sRouteBackendRef[] = subServices.map(s => ({
    name: s.name,
    weight: sTraffic,
    port: getServicePort(s.ports)
  }));
  if (remainTraffic > 0) {
    backendRefs[backendRefs.length - 1].weight = backendRefs[backendRefs.length - 1].weight
      ? backendRefs[backendRefs.length - 1].weight
      : 0 + remainTraffic;
  }
  return backendRefs;
};

export const getDefaultService = (subServices: ServiceOverview[]): string => {
  if (subServices && subServices.length > 0) {
    return `${subServices[0].name}:${getServicePort(subServices[0].ports)}`;
  }
  return '';
};

export const getDefaultWeights = (workloads: WorkloadOverview[]): WorkloadWeight[] => {
  const wkTraffic = workloads.length < 100 ? Math.floor(100 / workloads.length) : 0;
  const remainTraffic = workloads.length < 100 ? 100 % workloads.length : 0;
  const wkWeights: WorkloadWeight[] = workloads.map(workload => ({
    name: workload.name,
    weight: wkTraffic,
    locked: false,
    maxWeight: 100,
    mirrored: false
  }));
  if (remainTraffic > 0) {
    wkWeights[wkWeights.length - 1].weight = wkWeights[wkWeights.length - 1].weight + remainTraffic;
  }
  return wkWeights;
};

export const getInitWeights = (
  workloads: WorkloadOverview[],
  virtualServices: VirtualService[],
  destinationRules: DestinationRule[]
): WorkloadWeight[] => {
  const wkdVersionName = getWorkloadsByVersion(workloads, destinationRules);
  const wkdWeights: WorkloadWeight[] = [];
  if (virtualServices.length === 1) {
    let route: HTTPRoute | TCPRoute | TLSRoute | undefined;
    if (virtualServices[0].spec.http && virtualServices[0].spec.http!.length === 1) {
      route = virtualServices[0].spec.http![0];
    }
    if (virtualServices[0].spec.tcp && virtualServices[0].spec.tcp!.length === 1) {
      route = virtualServices[0].spec.tcp![0];
    }
    if (route) {
      // Populate WorkloadWeights from a VirtualService
      route.route?.forEach(route => {
        if (route.destination.subset && wkdVersionName[route.destination.subset]) {
          wkdWeights.push({
            name: wkdVersionName[route.destination.subset],
            weight: route.weight || 0,
            locked: false,
            maxWeight: 100,
            mirrored: false
          });
        }
      });

      // Convention: we place the mirror routes as last position
      if ((route as HTTPRoute).mirror) {
        const httpRoute = route as HTTPRoute;
        // Check mirror on HTTP Route
        if (httpRoute.mirror && httpRoute.mirror.subset && wkdVersionName[httpRoute.mirror.subset]) {
          const mirrorPercentage = httpRoute.mirrorPercentage ? httpRoute.mirrorPercentage.value : 100;
          wkdWeights.push({
            name: wkdVersionName[httpRoute.mirror.subset],
            weight: mirrorPercentage,
            locked: false,
            maxWeight: 100,
            mirrored: true
          });
        }
      }
    }
  }
  // Add new workloads with 0 weight if there is missing workloads
  if (wkdWeights.length > 0 && workloads.length !== wkdWeights.length) {
    for (let i = 0; i < workloads.length; i++) {
      const wkd = workloads[i];
      let newWkd = true;
      for (let j = 0; j < wkdWeights.length; j++) {
        const wkdWeight = wkdWeights[j];
        if (wkd.name === wkdWeight.name) {
          newWkd = false;
          break;
        }
      }
      if (newWkd) {
        wkdWeights.push({
          name: wkd.name,
          weight: 0,
          locked: false,
          maxWeight: 100,
          mirrored: false
        });
      }
    }
  }
  return wkdWeights;
};

export const getInitRules = (
  workloads: WorkloadOverview[],
  virtualServices: VirtualService[],
  destinationRules: DestinationRule[]
): Rule[] => {
  const wkdVersionName = getWorkloadsByVersion(workloads, destinationRules);
  const rules: Rule[] = [];
  if (virtualServices.length === 1) {
    virtualServices[0].spec.http!.forEach(httpRoute => {
      const rule: Rule = {
        matches: [],
        workloadWeights: []
      };
      if (httpRoute.match) {
        httpRoute.match.forEach(m => (rule.matches = rule.matches.concat(parseHttpMatchRequest(m))));
      }
      if (httpRoute.route) {
        httpRoute.route.forEach(r => {
          const subset = r.destination.subset;
          const workload = wkdVersionName[subset || ''];
          // Not adding a route if a workload is not found with a destination subset
          // That means that a workload has been deleted after a VS/DR has been generated
          if (workload) {
            rule.workloadWeights.push({
              name: workload,
              weight: r.weight ? r.weight : 0,
              locked: false,
              maxWeight: 100,
              mirrored: false
            });
          }
        });
      }

      if (httpRoute.mirror) {
        const subset = httpRoute.mirror.subset;
        const workload = wkdVersionName[subset || ''];
        rule.workloadWeights.push({
          name: workload,
          weight: httpRoute.mirrorPercentage ? httpRoute.mirrorPercentage.value : 100,
          locked: false,
          maxWeight: 100,
          mirrored: true
        });
      }

      if (httpRoute.fault) {
        if (httpRoute.fault.delay) {
          rule.delay = httpRoute.fault.delay;
        }
        if (httpRoute.fault.abort) {
          rule.abort = httpRoute.fault.abort;
        }
      }
      if (httpRoute.timeout) {
        rule.timeout = httpRoute.timeout;
      }
      if (httpRoute.retries) {
        rule.retries = httpRoute.retries;
      }
      // Not adding a rule if it has empty routes, probably this means that an existing workload was removed
      if (rule.workloadWeights.length > 0) {
        rules.push(rule);
      }
    });
  }
  return rules;
};

export const getInitK8sRules = (httpRoutes: K8sHTTPRoute[]): K8sRule[] => {
  const rules: K8sRule[] = [];
  if (httpRoutes && httpRoutes.length === 1 && httpRoutes[0].spec.rules) {
    httpRoutes[0].spec.rules.forEach(httpRoute => {
      const rule: K8sRule = {
        matches: [],
        filters: [],
        backendRefs: []
      };
      if (httpRoute.matches) {
        httpRoute.matches.forEach(m => (rule.matches = rule.matches.concat(parseK8sHTTPMatchRequest(m))));
      }
      if (httpRoute.filters) {
        httpRoute.filters.forEach(f => (rule.filters = rule.filters.concat(parseK8sHTTPRouteFilter(f))));
      }
      if (httpRoute.backendRefs) {
        httpRoute.backendRefs.forEach(bRef => {
          rule.backendRefs.push({
            name: bRef.name,
            weight: !bRef.weight || bRef.weight === 1 ? 100 : bRef.weight,
            port: !bRef.port ? 80 : bRef.port
          });
        });
      }

      // Not adding a rule if it has empty routes, probably this means that an existing service was removed
      if (rule.backendRefs && rule.backendRefs.length > 0) {
        rules.push(rule);
      }
    });
  }
  return rules;
};

export const getInitFaultInjectionRoute = (
  workloads: WorkloadOverview[],
  virtualServices: VirtualService[],
  destinationRules: DestinationRule[]
): FaultInjectionRoute => {
  // Read potential predefined weights
  let initWeights = getInitWeights(workloads, virtualServices, destinationRules);
  if (workloads.length > 0 && initWeights.length === 0) {
    initWeights = getDefaultWeights(workloads);
  }
  const fiRoute = {
    workloads: initWeights,
    delayed: false,
    delay: {
      percentage: {
        value: 100
      },
      fixedDelay: '5s'
    },
    isValidDelay: true,
    aborted: false,
    abort: {
      percentage: {
        value: 100
      },
      httpStatus: 503
    },
    isValidAbort: true
  };
  // This use case is intended for VS with single HTTP Route, others scenarios should use the Request Routing Wizard
  if (
    virtualServices.length === 1 &&
    virtualServices[0].spec.http &&
    virtualServices[0].spec.http.length === 1 &&
    virtualServices[0].spec.http[0].fault
  ) {
    const fault = virtualServices[0].spec.http[0].fault;
    if (fault.delay) {
      fiRoute.delayed = true;
      fiRoute.delay.percentage.value = fault.delay.percentage ? fault.delay.percentage.value : 100;
      fiRoute.delay.fixedDelay = fault.delay.fixedDelay;
    }
    if (fault.abort) {
      fiRoute.aborted = true;
      fiRoute.abort.percentage.value = fault.abort.percentage ? fault.abort.percentage.value : 100;
      fiRoute.abort.httpStatus = fault.abort.httpStatus;
    }
  }
  return fiRoute;
};

export const getInitTimeoutRetryRoute = (
  workloads: WorkloadOverview[],
  virtualServices: VirtualService[],
  destinationRules: DestinationRule[]
): TimeoutRetryRoute => {
  // Read potential predefined weights
  let initWeights = getInitWeights(workloads, virtualServices, destinationRules);
  if (workloads.length > 0 && initWeights.length === 0) {
    initWeights = getDefaultWeights(workloads);
  }
  const trRoute = {
    workloads: initWeights,
    isTimeout: false,
    timeout: '2s',
    isValidTimeout: true,
    isRetry: false,
    retries: {
      attempts: 3,
      perTryTimeout: '2s',
      retryOn: 'gateway-error,connect-failure,refused-stream'
    },
    isValidRetry: true
  };
  // This use case is intended for VS with single HTTP Route, others scenarios should use the Request Routing Wizard
  if (virtualServices.length === 1 && virtualServices[0].spec.http && virtualServices[0].spec.http.length === 1) {
    if (virtualServices[0].spec.http[0].timeout) {
      trRoute.isTimeout = true;
      trRoute.timeout = virtualServices[0].spec.http[0].timeout;
    }
    if (virtualServices[0].spec.http[0].retries) {
      trRoute.isRetry = true;
      trRoute.retries.attempts = virtualServices[0].spec.http[0].retries.attempts;
      if (virtualServices[0].spec.http[0].retries.perTryTimeout) {
        trRoute.retries.perTryTimeout = virtualServices[0].spec.http[0].retries.perTryTimeout;
      }
      if (virtualServices[0].spec.http[0].retries.retryOn) {
      }
    }
  }
  return trRoute;
};

export const getInitTlsMode = (destinationRules: DestinationRule[]): [string, string, string, string] => {
  if (
    destinationRules.length === 1 &&
    destinationRules[0].spec.trafficPolicy &&
    destinationRules[0].spec.trafficPolicy.tls
  ) {
    return [
      destinationRules[0].spec.trafficPolicy.tls.mode || '',
      destinationRules[0].spec.trafficPolicy.tls.clientCertificate || '',
      destinationRules[0].spec.trafficPolicy.tls.privateKey || '',
      destinationRules[0].spec.trafficPolicy.tls.caCertificates || ''
    ];
  }
  return ['', '', '', ''];
};

export const getInitLoadBalancer = (destinationRules: DestinationRule[]): LoadBalancerSettings | undefined => {
  if (
    destinationRules.length === 1 &&
    destinationRules[0].spec.trafficPolicy &&
    destinationRules[0].spec.trafficPolicy.loadBalancer
  ) {
    return destinationRules[0].spec.trafficPolicy.loadBalancer;
  }
  return undefined;
};

export const getInitPeerAuthentication = (
  destinationRules: DestinationRule[],
  peerAuthentications: PeerAuthentication[]
): PeerAuthenticationMutualTLSMode | undefined => {
  let paMode: PeerAuthenticationMutualTLSMode | undefined;
  if (
    destinationRules.length === 1 &&
    destinationRules[0].metadata.annotations &&
    destinationRules[0].metadata.annotations[KIALI_RELATED_LABEL]
  ) {
    let related = destinationRules[0].metadata.annotations[KIALI_RELATED_LABEL].split('/');
    if (related.length > 1) {
      const peerAuthn = peerAuthentications.find(
        (value: PeerAuthentication): boolean => value.metadata.name === related[1]
      );
      if (peerAuthn) {
        paMode = peerAuthn.spec!.mtls!.mode;
      }
    }
  }
  return paMode;
};

export const getInitConnectionPool = (destinationRules: DestinationRule[]): ConnectionPoolSettings | undefined => {
  if (
    destinationRules.length === 1 &&
    destinationRules[0].spec.trafficPolicy &&
    destinationRules[0].spec.trafficPolicy?.connectionPool
  ) {
    return destinationRules[0].spec.trafficPolicy?.connectionPool;
  }
  return undefined;
};

export const getInitOutlierDetection = (destinationRules: DestinationRule[]): OutlierDetection | undefined => {
  if (
    destinationRules.length === 1 &&
    destinationRules[0].spec.trafficPolicy &&
    destinationRules[0].spec.trafficPolicy?.outlierDetection
  ) {
    return destinationRules[0].spec.trafficPolicy?.outlierDetection;
  }
  return undefined;
};

export const hasGateway = (virtualServices: VirtualService[]): boolean => {
  // We need to if sentence, otherwise a potential undefined is not well handled
  if (
    virtualServices.length === 1 &&
    virtualServices[0] &&
    virtualServices[0].spec.gateways &&
    virtualServices[0].spec.gateways.length > 0
  ) {
    return true;
  }
  return false;
};

export const hasK8sGateway = (k8sHTTPRoutes: K8sHTTPRoute[]): boolean => {
  // We need to if sentence, otherwise a potential undefined is not well handled
  if (
    k8sHTTPRoutes &&
    k8sHTTPRoutes.length === 1 &&
    k8sHTTPRoutes[0] &&
    k8sHTTPRoutes[0].spec.parentRefs &&
    k8sHTTPRoutes[0].spec.parentRefs.length > 0
  ) {
    return true;
  }
  return false;
};

export const getInitHosts = (virtualServices: VirtualService[]): string[] => {
  if (virtualServices.length === 1 && virtualServices[0] && virtualServices[0].spec.hosts) {
    return virtualServices[0].spec.hosts;
  }
  return [];
};

export const getInitK8sHosts = (k8sHTTPRoutes: K8sHTTPRoute[]): string[] => {
  if (
    k8sHTTPRoutes &&
    k8sHTTPRoutes.length === 1 &&
    k8sHTTPRoutes[0] &&
    k8sHTTPRoutes[0].spec.hostnames &&
    k8sHTTPRoutes[0].spec.hostnames.length > 0
  ) {
    return k8sHTTPRoutes[0].spec.hostnames;
  }
  return [];
};

// VirtualServices added from the Kiali Wizard only support to add a single gateway
// and optionally a mesh gateway.
// This method returns a gateway selected by the user and if mesh is present
export const getInitGateway = (virtualServices: VirtualService[]): [string, boolean] => {
  if (
    virtualServices.length === 1 &&
    virtualServices[0] &&
    virtualServices[0].spec.gateways &&
    virtualServices[0].spec.gateways.length > 0
  ) {
    let selectedGateway = virtualServices[0].spec.gateways[0];
    if (selectedGateway === 'mesh') {
      // In Kiali Wizard, the first gateway is reserved for user gateway
      selectedGateway = '';
    }
    let meshPresent = false;
    if (virtualServices[0].spec.gateways.includes('mesh')) {
      meshPresent = true;
    }
    return [selectedGateway, meshPresent];
  }
  return ['', false];
};

// HTTPRoutes added from the Kiali Wizard only support to add a single K8s API gateway
// mesh gateway is not supported yet.
// This method returns a gateway selected by the user
export const getInitK8sGateway = (k8sHTTPRoutes: K8sHTTPRoute[]): string => {
  if (
    k8sHTTPRoutes &&
    k8sHTTPRoutes.length === 1 &&
    k8sHTTPRoutes[0] &&
    k8sHTTPRoutes[0].spec.parentRefs &&
    k8sHTTPRoutes[0].spec.parentRefs.length > 0
  ) {
    const name = k8sHTTPRoutes[0].spec.parentRefs[0].name;
    const namespace = k8sHTTPRoutes[0].spec.parentRefs[0].namespace;
    return `${namespace !== '' ? `${namespace}/` : ''}${name}`;
  }
  return '';
};

export const buildAuthorizationPolicy = (
  annotations: { [key: string]: string },
  labels: { [key: string]: string },
  name: string,
  namespace: string,
  state: AuthorizationPolicyState
): AuthorizationPolicy => {
  const ap: AuthorizationPolicy = {
    apiVersion: ISTIO_SECURITY_VERSION,
    kind: 'AuthorizationPolicy',
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'AuthorizationPolicy'
      }
    },
    spec: {}
  };

  addLabels(ap, labels);
  addAnnotations(ap, annotations);

  // DENY_ALL and ALLOW_ALL are two specific cases
  if (state.policy === 'DENY_ALL') {
    return ap;
  }

  if (state.policy === 'ALLOW_ALL') {
    ap.spec.action = ALLOW;
    ap.spec.rules = [{}];
    return ap;
  }

  // RULES use case
  if (state.workloadSelector.length > 0) {
    const workloadSelector: AuthorizationPolicyWorkloadSelector = {
      matchLabels: {}
    };
    state.workloadSelector.split(',').forEach(label => {
      label = label.trim();
      const labelDetails = label.split('=');
      if (labelDetails.length === 2) {
        workloadSelector.matchLabels[labelDetails[0]] = labelDetails[1];
      }
    });
    ap.spec.selector = workloadSelector;
  }

  if (state.rules.length > 0) {
    ap.spec.rules = [];
    state.rules.forEach(rule => {
      const appRule: AuthorizationPolicyRule = {
        from: [],
        to: [],
        when: []
      };
      if (rule.from.length > 0) {
        appRule.from = rule.from.map(fromItem => {
          const source: Source = {};
          Object.keys(fromItem).forEach(key => {
            source[key] = fromItem[key];
          });
          return {
            source: source
          };
        });
      }
      if (rule.to.length > 0) {
        appRule.to = rule.to.map(toItem => {
          const operation: Operation = {};
          Object.keys(toItem).forEach(key => {
            operation[key] = toItem[key];
          });
          return {
            operation: operation
          };
        });
      }
      if (rule.when.length > 0) {
        appRule.when = rule.when.map(condition => {
          const cond: Condition = {
            key: condition.key,
            values: [],
            notValues: []
          };
          if (condition.values && condition.values.length > 0) {
            cond.values = condition.values;
          }
          if (condition.notValues && condition.notValues.length > 0) {
            cond.notValues = condition.notValues;
          }
          return cond;
        });
      }
      ap.spec.rules!.push(appRule);
    });
  }
  if (state.action.length > 0) {
    ap.spec.action = state.action;
  }
  return ap;
};

export const buildGraphSidecars = (namespace: string, graph: GraphDefinition): Sidecar[] => {
  const sidecars: Sidecar[] = [];

  if (graph.elements.nodes) {
    for (let i = 0; i < graph.elements.nodes.length; i++) {
      const node = graph.elements.nodes[i];
      if (
        node.data.namespace === namespace &&
        node.data.nodeType === NodeType.WORKLOAD &&
        node.data.workload &&
        node.data.app &&
        node.data.version
      ) {
        const sc: Sidecar = {
          kind: 'Sidecar',
          apiVersion: ISTIO_NETWORKING_VERSION,
          metadata: {
            name: node.data.workload,
            namespace: namespace,
            labels: {
              [KIALI_WIZARD_LABEL]: 'Sidecar'
            }
          },
          spec: {
            workloadSelector: {
              labels: {
                app: node.data.app,
                version: node.data.version
              }
            },
            egress: [
              {
                hosts: [`${serverConfig.istioNamespace}/*`]
              }
            ]
          }
        };

        if (graph.elements.edges) {
          for (let j = 0; j < graph.elements.edges.length; j++) {
            const edge = graph.elements.edges[j];

            if (node.data.id === edge.data.source) {
              for (let z = 0; z < graph.elements.nodes.length; z++) {
                const targetNode = graph.elements.nodes[z];

                if (targetNode.data.id === edge.data.target) {
                  targetNode.data.destServices?.forEach((ds: DestService) => {
                    if (sc.spec.egress && ds.namespace !== 'unknown') {
                      sc.spec.egress[0].hosts.push(
                        `${ds.namespace}/${ds.name}.${ds.namespace}.${serverConfig.istioIdentityDomain}`
                      );
                    }
                  });
                }
              }
            }
          }
        }

        sidecars.push(sc);
      }
    }
  }

  return sidecars;
};

export const buildGraphAuthorizationPolicy = (namespace: string, graph: GraphDefinition): AuthorizationPolicy[] => {
  const denyAll: AuthorizationPolicy = {
    kind: 'AuthorizationPolicy',
    apiVersion: 'security.istio.io/v1',
    metadata: {
      name: `deny-all-${namespace}`,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'AuthorizationPolicy'
      }
    },
    spec: {}
  };
  const aps: AuthorizationPolicy[] = [denyAll];

  if (graph.elements.nodes) {
    for (let i = 0; i < graph.elements.nodes.length; i++) {
      const node = graph.elements.nodes[i];
      if (
        node.data.namespace === namespace &&
        node.data.nodeType === NodeType.WORKLOAD &&
        node.data.workload &&
        node.data.app &&
        node.data.version
      ) {
        const ap: AuthorizationPolicy = {
          kind: 'AuthorizationPolicy',
          apiVersion: ISTIO_SECURITY_VERSION,
          metadata: {
            name: node.data.workload,
            namespace: namespace,
            labels: {
              [KIALI_WIZARD_LABEL]: 'AuthorizationPolicy'
            }
          },
          spec: {
            selector: {
              matchLabels: {
                app: node.data.app,
                version: node.data.version
              }
            },
            rules: [
              {
                from: [
                  {
                    source: {
                      principals: []
                    }
                  }
                ]
              }
            ]
          }
        };
        let principalsLen = 0;
        if (graph.elements.edges) {
          for (let j = 0; j < graph.elements.edges.length; j++) {
            const edge = graph.elements.edges[j];
            if (node.data.id === edge.data.target) {
              if (
                ap.spec.rules &&
                ap.spec.rules[0] &&
                ap.spec.rules[0].from &&
                ap.spec.rules[0].from[0] &&
                ap.spec.rules[0].from[0].source &&
                ap.spec.rules[0].from[0].source.principals &&
                edge.data.sourcePrincipal
              ) {
                const principal = edge.data.sourcePrincipal.startsWith('spiffe://')
                  ? edge.data.sourcePrincipal.substring(9)
                  : edge.data.sourcePrincipal;
                ap.spec.rules[0].from[0].source.principals.push(principal);
                principalsLen++;
              }
            }
          }
        }
        if (principalsLen > 0) {
          aps.push(ap);
        }
      }
    }
  }
  return aps;
};

export const buildGateway = (
  annotations: { [key: string]: string },
  labels: { [key: string]: string },
  name: string,
  namespace: string,
  state: GatewayState
): Gateway => {
  const gw: Gateway = {
    kind: 'Gateway',
    apiVersion: ISTIO_NETWORKING_VERSION,
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'Gateway'
      }
    },
    spec: {
      // Default for istio scenarios, user may change it editing YAML
      selector: {},
      servers: state.gatewayServers.map(s => ({
        port: s.port,
        hosts: s.hosts,
        tls: s.tls || {}
      }))
    }
  };
  addLabels(gw, labels);
  addAnnotations(gw, annotations);

  state.workloadSelectorLabels
    .trim()
    .split(',')
    .forEach(split => {
      const labels = split.trim().split('=');
      // It should be already validated with workloadSelectorValid, but just to add extra safe check
      if (gw.spec.selector && labels.length === 2) {
        gw.spec.selector[labels[0].trim()] = labels[1].trim();
      }
    });
  return gw;
};

export const buildK8sGateway = (
  annotations: { [key: string]: string },
  labels: { [key: string]: string },
  name: string,
  namespace: string,
  state: K8sGatewayState
): K8sGateway => {
  const k8sGateway: K8sGateway = {
    kind: 'Gateway',
    apiVersion: GATEWAY_NETWORKING_VERSION,
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'K8sGateway'
      }
    },
    spec: {
      // Default for istio scenarios, user may change it editing YAML
      gatewayClassName: state.gatewayClass,
      listeners: state.listeners
    }
  };

  if (state.addresses.length > 0) {
    k8sGateway.spec.addresses = state.addresses.map(s => ({
      type: s.type,
      value: s.value
    }));
  }

  addLabels(k8sGateway, labels);
  addAnnotations(k8sGateway, annotations);

  return k8sGateway;
};

export const buildK8sReferenceGrant = (
  annotations: { [key: string]: string },
  labels: { [key: string]: string },
  name: string,
  namespace: string,
  state: K8sReferenceGrantState
): K8sReferenceGrant => {
  const k8sReferenceGrant: K8sReferenceGrant = {
    kind: 'ReferenceGrant',
    apiVersion: GATEWAY_NETWORKING_VERSION,
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'K8sReferenceGrant'
      }
    },
    spec: {
      from: state.from,
      to: state.to
    }
  };
  addLabels(k8sReferenceGrant, labels);
  addAnnotations(k8sReferenceGrant, annotations);

  return k8sReferenceGrant;
};

export const buildPeerAuthentication = (
  annotations: { [key: string]: string },
  labels: { [key: string]: string },
  name: string,
  namespace: string,
  state: PeerAuthenticationState
): PeerAuthentication => {
  const pa: PeerAuthentication = {
    apiVersion: ISTIO_SECURITY_VERSION,
    kind: 'PeerAuthentication',
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'PeerAuthentication'
      }
    },
    spec: {}
  };
  addLabels(pa, labels);
  addAnnotations(pa, annotations);

  if (state.workloadSelector.length > 0) {
    const workloadSelector: PeerAuthenticationWorkloadSelector = {
      matchLabels: {}
    };
    state.workloadSelector.split(',').forEach(label => {
      label = label.trim();
      const labelDetails = label.split('=');
      if (labelDetails.length === 2) {
        workloadSelector.matchLabels[labelDetails[0]] = labelDetails[1];
      }
    });
    pa.spec.selector = workloadSelector;
  }

  // Kiali is always adding this field
  pa.spec.mtls = {
    mode: PeerAuthenticationMutualTLSMode[state.mtls]
  };

  if (state.portLevelMtls.length > 0) {
    pa.spec.portLevelMtls = {};
    state.portLevelMtls.forEach(p => {
      if (pa.spec.portLevelMtls) {
        pa.spec.portLevelMtls[Number(p.port)] = {
          mode: PeerAuthenticationMutualTLSMode[p.mtls]
        };
      }
    });
  }

  return pa;
};

export const buildRequestAuthentication = (
  annotations: { [key: string]: string },
  labels: { [key: string]: string },
  name: string,
  namespace: string,
  state: RequestAuthenticationState
): RequestAuthentication => {
  const ra: RequestAuthentication = {
    apiVersion: ISTIO_SECURITY_VERSION,
    kind: 'RequestAuthentication',
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'RequestAuthentication'
      }
    },
    spec: {
      jwtRules: []
    }
  };
  addLabels(ra, labels);
  addAnnotations(ra, annotations);

  if (state.workloadSelector.length > 0) {
    const workloadSelector: WorkloadMatchSelector = {
      matchLabels: {}
    };
    state.workloadSelector.split(',').forEach(label => {
      label = label.trim();
      const labelDetails = label.split('=');
      if (labelDetails.length === 2) {
        workloadSelector.matchLabels[labelDetails[0]] = labelDetails[1];
      }
    });
    ra.spec.selector = workloadSelector;
  }

  if (state.jwtRules.length > 0) {
    ra.spec.jwtRules = state.jwtRules;
  }
  return ra;
};

export const buildServiceEntry = (
  annotations: { [key: string]: string },
  labels: { [key: string]: string },
  name: string,
  namespace: string,
  state: ServiceEntryState
): ServiceEntry => {
  const se: ServiceEntry = {
    apiVersion: ISTIO_NETWORKING_VERSION,
    kind: 'ServiceEntry',
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'ServiceEntry'
      }
    },
    spec: state.serviceEntry
  };
  addLabels(se, labels);
  addAnnotations(se, annotations);

  return se;
};

export const buildSidecar = (
  annotations: { [key: string]: string },
  labels: { [key: string]: string },
  name: string,
  namespace: string,
  state: SidecarState
): Sidecar => {
  const sc: Sidecar = {
    apiVersion: ISTIO_NETWORKING_VERSION,
    kind: 'Sidecar',
    metadata: {
      name: name,
      namespace: namespace,
      labels: {
        [KIALI_WIZARD_LABEL]: 'Sidecar'
      }
    },
    spec: {
      egress: [
        {
          hosts: state.egressHosts.map(eh => eh.host)
        }
      ]
    }
  };
  if (state.addWorkloadSelector && state.workloadSelectorValid) {
    sc.spec.workloadSelector = {
      labels: {}
    };
    state.workloadSelectorLabels
      .trim()
      .split(',')
      .forEach(split => {
        const labels = split.trim().split('=');
        // It should be already validated with workloadSelectorValid, but just to add extra safe check
        if (sc.spec.workloadSelector && labels.length === 2) {
          sc.spec.workloadSelector.labels[labels[0].trim()] = labels[1].trim();
        }
      });
  }
  addLabels(sc, labels);
  addAnnotations(sc, annotations);

  return sc;
};

export const buildNamespaceInjectionPatch = (enable: boolean, remove: boolean, revision: string | null): string => {
  const labels = {};
  if (revision) {
    labels[serverConfig.istioLabels.injectionLabelName] = null;
    labels[serverConfig.istioLabels.injectionLabelRev] = revision;
  } else {
    labels[serverConfig.istioLabels.injectionLabelName] = remove ? null : enable ? 'enabled' : 'disabled';
    labels[serverConfig.istioLabels.injectionLabelRev] = null;
  }
  const patch = {
    metadata: {
      labels: labels
    }
  };
  return JSON.stringify(patch);
};

export const buildWorkloadInjectionPatch = (workloadType: string, enable: boolean, remove: boolean): string => {
  const patch = {};

  // environments prefer to use the pod label over the annotation
  // we will be opinionated here and always use the label and remove any annotation that may exist to avoid conflicts
  const labels = {};
  labels[serverConfig.istioAnnotations.istioInjectionAnnotation] = remove ? null : enable ? 'true' : 'false';
  const annotations = {};
  annotations[serverConfig.istioAnnotations.istioInjectionAnnotation] = null;
  if (workloadType === 'Pod') {
    patch['labels'] = labels;
    patch['annotations'] = annotations;
  } else {
    patch['spec'] = {
      template: {
        metadata: {
          labels: labels,
          annotations: annotations
        }
      }
    };
  }

  return JSON.stringify(patch);
};

export const buildAnnotationPatch = (annotations: { [key: string]: string }): string => {
  const patch = [
    {
      op: 'replace',
      path: '/metadata/annotations',
      value: annotations
    }
  ];
  return JSON.stringify(patch);
};

export const addLabels = (istioObject: IstioObject, value: { [key: string]: string }): void => {
  istioObject.metadata.labels = value;
};

export const addAnnotations = (istioObject: IstioObject, value: { [key: string]: string }): void => {
  istioObject.metadata.annotations = value;
};
