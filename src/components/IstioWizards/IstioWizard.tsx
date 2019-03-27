import * as React from 'react';
import { Button, Wizard } from 'patternfly-react';
import { WorkloadOverview } from '../../types/ServiceInfo';
import {
  DestinationRule,
  DestinationWeight,
  HTTPMatchRequest,
  HTTPRoute,
  VirtualService
} from '../../types/IstioObjects';
import { serverConfig } from '../../config/serverConfig';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import MatchingRouting from './MatchingRouting';
import WeightedRouting, { WorkloadWeight } from './WeightedRouting';
import TrafficPolicyConnected from '../../containers/TrafficPolicyContainer';
import { DISABLE, ROUND_ROBIN } from './TrafficPolicy';
import { TLSStatus } from '../../types/TLSStatus';
import SuspendTraffic, { SuspendedRoute } from './SuspendTraffic';
import { Rule } from './MatchingRouting/Rules';

type Props = {
  show: boolean;
  type: string;
  namespace: string;
  serviceName: string;
  tlsStatus?: TLSStatus;
  workloads: WorkloadOverview[];
  onClose: (changed: boolean) => void;
};

type State = {
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

export const WIZARD_WEIGHTED_ROUTING = 'create_weighted_routing';
export const WIZARD_MATCHING_ROUTING = 'create_matching_routing';
export const WIZARD_SUSPEND_TRAFFIC = 'suspend_traffic';

export const WIZARD_TITLES = {
  [WIZARD_WEIGHTED_ROUTING]: 'Create Weighted Routing',
  [WIZARD_MATCHING_ROUTING]: 'Create Matching Routing',
  [WIZARD_SUSPEND_TRAFFIC]: 'Suspend Traffic'
};

const SERVICE_UNAVAILABLE = 503;

class IstioWizard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showWizard: false,
      workloads: [],
      rules: [],
      suspendedRoutes: [],
      valid: true,
      mtlsMode: DISABLE,
      tlsModified: false,
      loadBalancer: ROUND_ROBIN,
      lbModified: false
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.show !== this.props.show || !this.compareWorkloads(prevProps.workloads, this.props.workloads)) {
      let isValid: boolean;
      switch (this.props.type) {
        // By default the rule of Weighted routing should be valid
        case WIZARD_WEIGHTED_ROUTING:
          isValid = true;
          break;
        // By default no rules is a no valid scenario
        case WIZARD_MATCHING_ROUTING:
          isValid = false;
          break;
        case WIZARD_SUSPEND_TRAFFIC:
        default:
          isValid = true;
          break;
      }
      this.setState({
        showWizard: this.props.show,
        workloads: [],
        rules: [],
        valid: isValid,
        mtlsMode: DISABLE,
        loadBalancer: ROUND_ROBIN
      });
    }
  }

  compareWorkloads = (prev: WorkloadOverview[], current: WorkloadOverview[]): boolean => {
    if (prev.length !== current.length) {
      return false;
    }
    for (let i = 0; i < prev.length; i++) {
      if (!current.includes(prev[i])) {
        return false;
      }
    }
    return true;
  };

  buildHTTPMatchRequest = (matches: string[]): HTTPMatchRequest[] => {
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

  createIstioTraffic = (): [DestinationRule, VirtualService] => {
    const wkdNameVersion: { [key: string]: string } = {};

    // DestinationRule from the labels
    const wizardDR: DestinationRule = {
      metadata: {
        namespace: this.props.namespace,
        name: this.props.serviceName
      },
      spec: {
        host: this.props.serviceName,
        subsets: this.props.workloads.map(workload => {
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
        namespace: this.props.namespace,
        name: this.props.serviceName
      },
      spec: {}
    };

    switch (this.props.type) {
      case WIZARD_WEIGHTED_ROUTING: {
        // VirtualService from the weights
        wizardVS.spec = {
          hosts: [this.props.serviceName],
          http: [
            {
              route: this.state.workloads.map(workload => {
                return {
                  destination: {
                    host: this.props.serviceName,
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
          hosts: [this.props.serviceName],
          http: this.state.rules.map(rule => {
            const httpRoute: HTTPRoute = {};
            httpRoute.route = [];
            for (let iRoute = 0; iRoute < rule.routes.length; iRoute++) {
              const destW: DestinationWeight = {
                destination: {
                  host: this.props.serviceName,
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
              httpRoute.match = this.buildHTTPMatchRequest(rule.matches);
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
        const totalRoutes = this.state.suspendedRoutes.length;
        const closeRoutes = this.state.suspendedRoutes.filter(s => s.suspended).length;
        const openRoutes = totalRoutes - closeRoutes;
        let firstValue = true;
        // If we have some suspended routes, we need to use weights
        if (closeRoutes < totalRoutes) {
          for (let i = 0; i < this.state.suspendedRoutes.length; i++) {
            const suspendedRoute = this.state.suspendedRoutes[i];
            const destW: DestinationWeight = {
              destination: {
                host: this.props.serviceName,
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
                host: this.props.serviceName
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
          hosts: [this.props.serviceName],
          http: [httpRoute]
        };
        break;
      }
      default:
        console.log('Unrecognized type');
    }

    if (this.state.tlsModified || this.state.lbModified) {
      wizardDR.spec.trafficPolicy = {};
      if (this.state.tlsModified) {
        wizardDR.spec.trafficPolicy.tls = {
          mode: this.state.mtlsMode
        };
      }
      if (this.state.lbModified) {
        wizardDR.spec.trafficPolicy.loadBalancer = {
          simple: this.state.loadBalancer
        };
      }
    }
    return [wizardDR, wizardVS];
  };

  onClose = () => {
    this.setState({
      showWizard: false
    });
    this.props.onClose(false);
  };

  onCreate = () => {
    const [dr, vr] = this.createIstioTraffic();
    const createDR = API.createIstioConfigDetail(this.props.namespace, 'destinationrules', JSON.stringify(dr));
    const createVS = API.createIstioConfigDetail(this.props.namespace, 'virtualservices', JSON.stringify(vr));
    // Disable button before promise is completed. Then Wizard is closed.
    this.setState({
      valid: false
    });
    Promise.all([createDR, createVS])
      .then(results => {
        this.props.onClose(true);
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not create Istio config objects', error));
        this.props.onClose(true);
      });
  };

  onTLS = (mTLS: string) => {
    this.setState({
      mtlsMode: mTLS,
      tlsModified: true
    });
  };

  onLoadBalancer = (simple: string) => {
    this.setState({
      loadBalancer: simple,
      lbModified: true
    });
  };

  onWeightsChange = (valid: boolean, workloads: WorkloadWeight[], reset: boolean) => {
    this.setState({
      valid: valid,
      workloads: workloads
    });
  };

  onRulesChange = (valid: boolean, rules: Rule[]) => {
    this.setState({
      valid: valid,
      rules: rules
    });
  };

  onSuspendedChange = (valid: boolean, suspendedRoutes: SuspendedRoute[]) => {
    this.setState({
      valid: valid,
      suspendedRoutes: suspendedRoutes
    });
  };

  render() {
    return (
      <Wizard show={this.state.showWizard} onHide={this.onClose}>
        <Wizard.Header onClose={this.onClose} title={WIZARD_TITLES[this.props.type]} />
        <Wizard.Body>
          <Wizard.Row>
            <Wizard.Main>
              <Wizard.Contents stepIndex={0} activeStepIndex={0}>
                {this.props.type === WIZARD_WEIGHTED_ROUTING && (
                  <WeightedRouting
                    serviceName={this.props.serviceName}
                    workloads={this.props.workloads}
                    onChange={this.onWeightsChange}
                  />
                )}
                {this.props.type === WIZARD_MATCHING_ROUTING && (
                  <MatchingRouting
                    serviceName={this.props.serviceName}
                    workloads={this.props.workloads}
                    onChange={this.onRulesChange}
                  />
                )}
                {this.props.type === WIZARD_SUSPEND_TRAFFIC && (
                  <SuspendTraffic
                    serviceName={this.props.serviceName}
                    workloads={this.props.workloads}
                    onChange={this.onSuspendedChange}
                  />
                )}
                <TrafficPolicyConnected
                  mtlsMode={this.state.mtlsMode}
                  loadBalancer={this.state.loadBalancer}
                  onTlsChange={this.onTLS}
                  onLoadbalancerChange={this.onLoadBalancer}
                  expanded={false}
                  nsWideStatus={this.props.tlsStatus}
                />
              </Wizard.Contents>
            </Wizard.Main>
          </Wizard.Row>
        </Wizard.Body>
        <Wizard.Footer>
          <Button bsStyle="default" className="btn-cancel" onClick={this.onClose}>
            Cancel
          </Button>
          <Button disabled={!this.state.valid} bsStyle="primary" onClick={this.onCreate}>
            Create
          </Button>
        </Wizard.Footer>
      </Wizard>
    );
  }
}

export default IstioWizard;
