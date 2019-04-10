import { TLSStatus } from '../../types/TLSStatus';
import { WorkloadOverview } from '../../types/ServiceInfo';
import { WorkloadWeight } from './WeightedRouting';
import { Rule } from './MatchingRouting/Rules';
import { SuspendedRoute } from './SuspendTraffic';
import {
  DestinationRule,
  DestinationRules,
  DestinationWeight,
  HTTPMatchRequest,
  HTTPRoute,
  StringMatch,
  VirtualService,
  VirtualServices
} from '../../types/IstioObjects';
import { serverConfig } from '../../config';

export const WIZARD_WEIGHTED_ROUTING = 'weighted_routing';
export const WIZARD_MATCHING_ROUTING = 'matching_routing';
export const WIZARD_SUSPEND_TRAFFIC = 'suspend_traffic';

export const WIZARD_ACTIONS = [WIZARD_WEIGHTED_ROUTING, WIZARD_MATCHING_ROUTING, WIZARD_SUSPEND_TRAFFIC];

export const WIZARD_TITLES = {
  [WIZARD_WEIGHTED_ROUTING]: 'Create Weighted Routing',
  [WIZARD_MATCHING_ROUTING]: 'Create Matching Routing',
  [WIZARD_SUSPEND_TRAFFIC]: 'Suspend Traffic'
};

export const WIZARD_UPDATE_TITLES = {
  [WIZARD_WEIGHTED_ROUTING]: 'Update Weighted Routing',
  [WIZARD_MATCHING_ROUTING]: 'Update Matching Routing',
  [WIZARD_SUSPEND_TRAFFIC]: 'Update Suspended Traffic'
};

export type WizardProps = {
  show: boolean;
  type: string;
  update: boolean;
  namespace: string;
  serviceName: string;
  tlsStatus?: TLSStatus;
  workloads: WorkloadOverview[];
  virtualServices: VirtualServices;
  destinationRules: DestinationRules;
  onClose: (changed: boolean) => void;
};

export type WizardState = {
  showWizard: boolean;
  workloads: WorkloadWeight[];
  rules: Rule[];
  suspendedRoutes: SuspendedRoute[];
  valid: boolean;
  mtlsMode: string;
  tlsModified: boolean;
  loadBalancer: string;
  lbModified: boolean;
};

const SERVICE_UNAVAILABLE = 503;

export const KIALI_WIZARD_LABEL = 'kiali_wizard';

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

const parseStringMatch = (value: StringMatch): string => {
  if (value.exact) {
    return 'exact ' + value.exact;
  }
  if (value.prefix) {
    return 'prefix ' + value.prefix;
  }
  if (value.regex) {
    return 'regex ' + value.regex;
  }
  return '';
};

const parseHttpMatchRequest = (httpMatchRequest: HTTPMatchRequest): string[] => {
  const matches: string[] = [];
  // Headers
  if (httpMatchRequest.headers) {
    Object.keys(httpMatchRequest.headers).forEach(headerName => {
      const value = httpMatchRequest.headers![headerName];
      matches.push('headers [' + headerName + '] ' + parseStringMatch(value));
    });
  }
  if (httpMatchRequest.uri) {
    matches.push('uri ' + parseStringMatch(httpMatchRequest.uri));
  }
  if (httpMatchRequest.scheme) {
    matches.push('scheme ' + parseStringMatch(httpMatchRequest.scheme));
  }
  if (httpMatchRequest.method) {
    matches.push('method ' + parseStringMatch(httpMatchRequest.method));
  }
  if (httpMatchRequest.authority) {
    matches.push('authority ' + parseStringMatch(httpMatchRequest.authority));
  }
  return matches;
};

export const buildIstioConfig = (wProps: WizardProps, wState: WizardState): [DestinationRule, VirtualService] => {
  const wkdNameVersion: { [key: string]: string } = {};

  // DestinationRule from the labels
  const wizardDR: DestinationRule = {
    metadata: {
      namespace: wProps.namespace,
      name: wProps.serviceName,
      labels: {
        [KIALI_WIZARD_LABEL]: wProps.type
      }
    },
    spec: {
      host: wProps.serviceName,
      subsets: wProps.workloads.map(workload => {
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
      })
    }
  };

  const wizardVS: VirtualService = {
    metadata: {
      namespace: wProps.namespace,
      name: wProps.serviceName,
      labels: {
        [KIALI_WIZARD_LABEL]: wProps.type
      }
    },
    spec: {}
  };

  switch (wProps.type) {
    case WIZARD_WEIGHTED_ROUTING: {
      // VirtualService from the weights
      wizardVS.spec = {
        hosts: [wProps.serviceName],
        http: [
          {
            route: wState.workloads.map(workload => {
              return {
                destination: {
                  host: wProps.serviceName,
                  subset: wkdNameVersion[workload.name]
                },
                weight: workload.weight
              };
            })
          }
        ]
      };
      break;
    }
    case WIZARD_MATCHING_ROUTING: {
      // VirtualService from the routes
      wizardVS.spec = {
        hosts: [wProps.serviceName],
        http: wState.rules.map(rule => {
          const httpRoute: HTTPRoute = {};
          httpRoute.route = [];
          for (let iRoute = 0; iRoute < rule.routes.length; iRoute++) {
            const destW: DestinationWeight = {
              destination: {
                host: wProps.serviceName,
                subset: wkdNameVersion[rule.routes[iRoute]]
              }
            };
            destW.weight = Math.floor(100 / rule.routes.length);
            if (iRoute === 0) {
              destW.weight = destW.weight + (100 % rule.routes.length);
            }
            httpRoute.route.push(destW);
          }

          if (rule.matches.length > 0) {
            httpRoute.match = buildHTTPMatchRequest(rule.matches);
          }
          return httpRoute;
        })
      };
      break;
    }
    case WIZARD_SUSPEND_TRAFFIC: {
      // VirtualService from the suspendedRoutes
      const httpRoute: HTTPRoute = {
        route: []
      };
      // Let's use the # os suspended notes to create weights
      const totalRoutes = wState.suspendedRoutes.length;
      const closeRoutes = wState.suspendedRoutes.filter(s => s.suspended).length;
      const openRoutes = totalRoutes - closeRoutes;
      let firstValue = true;
      // If we have some suspended routes, we need to use weights
      if (closeRoutes < totalRoutes) {
        for (let i = 0; i < wState.suspendedRoutes.length; i++) {
          const suspendedRoute = wState.suspendedRoutes[i];
          const destW: DestinationWeight = {
            destination: {
              host: wProps.serviceName,
              subset: wkdNameVersion[suspendedRoute.workload]
            }
          };
          if (suspendedRoute.suspended) {
            // A suspended route has a 0 weight
            destW.weight = 0;
          } else {
            destW.weight = Math.floor(100 / openRoutes);
            // We need to adjust the rest
            if (firstValue) {
              destW.weight += 100 % openRoutes;
              firstValue = false;
            }
          }
          httpRoute.route!.push(destW);
        }
      } else {
        // All routes are suspended, so we use an fault/abort rule
        httpRoute.route = [
          {
            destination: {
              host: wProps.serviceName
            }
          }
        ];
        httpRoute.fault = {
          abort: {
            httpStatus: SERVICE_UNAVAILABLE,
            percentage: {
              value: 100
            }
          }
        };
      }
      wizardVS.spec = {
        hosts: [wProps.serviceName],
        http: [httpRoute]
      };
      break;
    }
    default:
      console.log('Unrecognized type');
  }

  if (wState.tlsModified || wState.lbModified) {
    wizardDR.spec.trafficPolicy = {};
    if (wState.tlsModified) {
      wizardDR.spec.trafficPolicy.tls = {
        mode: wState.mtlsMode
      };
    }
    if (wState.lbModified) {
      wizardDR.spec.trafficPolicy.loadBalancer = {
        simple: wState.loadBalancer
      };
    }
  }
  return [wizardDR, wizardVS];
};

const getWorkloadsByVersion = (workloads: WorkloadOverview[]): { [key: string]: string } => {
  const versionLabelName = serverConfig.istioLabels.versionLabelName;
  const wkdVersionName: { [key: string]: string } = {};
  workloads.forEach(workload => (wkdVersionName[workload.labels![versionLabelName]] = workload.name));
  return wkdVersionName;
};

export const getInitWeights = (workloads: WorkloadOverview[], virtualServices: VirtualServices): WorkloadWeight[] => {
  const wkdVersionName = getWorkloadsByVersion(workloads);
  const wkdWeights: WorkloadWeight[] = [];
  if (virtualServices.items.length === 1 && virtualServices.items[0].spec.http!.length === 1) {
    // Populate WorkloadWeights from a VirtualService
    virtualServices.items[0].spec.http![0].route!.forEach(route => {
      if (route.destination.subset) {
        wkdWeights.push({
          name: wkdVersionName[route.destination.subset],
          weight: route.weight || 0,
          locked: false,
          maxWeight: 100
        });
      }
    });
  }
  return wkdWeights;
};

export const getInitRules = (workloads: WorkloadOverview[], virtualServices: VirtualServices): Rule[] => {
  const wkdVersionName = getWorkloadsByVersion(workloads);
  const rules: Rule[] = [];
  if (virtualServices.items.length === 1) {
    virtualServices.items[0].spec.http!.forEach(httpRoute => {
      const rule: Rule = {
        matches: [],
        routes: []
      };
      if (httpRoute.match) {
        httpRoute.match.forEach(m => (rule.matches = rule.matches.concat(parseHttpMatchRequest(m))));
      }
      if (httpRoute.route) {
        httpRoute.route.forEach(r => rule.routes.push(wkdVersionName[r.destination.subset || '']));
      }
      rules.push(rule);
    });
  }
  return rules;
};

export const getInitSuspendedRoutes = (
  workloads: WorkloadOverview[],
  virtualServices: VirtualServices
): SuspendedRoute[] => {
  const wkdVersionName = getWorkloadsByVersion(workloads);
  const routes: SuspendedRoute[] = workloads.map(wk => ({
    workload: wk.name,
    suspended: true,
    httpStatus: SERVICE_UNAVAILABLE
  }));
  if (virtualServices.items.length === 1 && virtualServices.items[0].spec.http!.length === 1) {
    // All routes are suspended default value is correct
    if (virtualServices.items[0].spec.http![0].fault) {
      return routes;
    }
    // Iterate on route weights to identify the suspended routes
    virtualServices.items[0].spec.http![0].route!.forEach(route => {
      if (route.weight && route.weight > 0) {
        const workloadName = wkdVersionName[route.destination.subset || ''];
        routes.filter(w => w.workload === workloadName).forEach(w => (w.suspended = false));
      }
    });
  }
  return routes;
};

export const getInitTlsMode = (destinationRules: DestinationRules): string => {
  if (
    destinationRules.items.length === 1 &&
    destinationRules.items[0].spec.trafficPolicy &&
    destinationRules.items[0].spec.trafficPolicy.tls
  ) {
    return destinationRules.items[0].spec.trafficPolicy.tls.mode || '';
  }
  return '';
};

export const getInitLoadBalancer = (destinationRules: DestinationRules): string => {
  if (
    destinationRules.items.length === 1 &&
    destinationRules.items[0].spec.trafficPolicy &&
    destinationRules.items[0].spec.trafficPolicy.loadBalancer
  ) {
    return destinationRules.items[0].spec.trafficPolicy.loadBalancer.simple || '';
  }
  return '';
};
