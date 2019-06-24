import * as React from 'react';
import { Button, ExpandCollapse, Wizard } from 'patternfly-react';
import { WorkloadOverview } from '../../types/ServiceInfo';
import * as API from '../../services/Api';
import { Response } from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';
import MatchingRouting from './MatchingRouting';
import WeightedRouting, { WorkloadWeight } from './WeightedRouting';
import TrafficPolicyContainer, {
  ConsistentHashType,
  TrafficPolicyState
} from '../../components/IstioWizards/TrafficPolicy';
import { DISABLE, ROUND_ROBIN } from './TrafficPolicy';
import SuspendTraffic, { SuspendedRoute } from './SuspendTraffic';
import { Rule } from './MatchingRouting/Rules';
import {
  buildIstioConfig,
  getInitGateway,
  getInitHosts,
  getInitLoadBalancer,
  getInitRules,
  getInitSuspendedRoutes,
  getInitTlsMode,
  getInitWeights,
  hasGateway,
  WIZARD_MATCHING_ROUTING,
  WIZARD_SUSPEND_TRAFFIC,
  WIZARD_THREESCALE_INTEGRATION,
  WIZARD_TITLES,
  WIZARD_UPDATE_TITLES,
  WIZARD_WEIGHTED_ROUTING,
  WizardProps,
  WizardState
} from './IstioWizardActions';
import { MessageType } from '../../types/MessageCenter';
import ThreeScaleIntegration from './ThreeScaleIntegration';
import { ThreeScaleServiceRule } from '../../types/ThreeScale';
import { style } from 'typestyle';
import GatewaySelector, { GatewaySelectorState } from './GatewaySelector';
import VirtualServiceHosts from './VirtualServiceHosts';

const expandStyle = style({
  $nest: {
    '.btn': {
      fontSize: '14px'
    }
  }
});

class IstioWizard extends React.Component<WizardProps, WizardState> {
  constructor(props: WizardProps) {
    super(props);
    this.state = {
      showWizard: false,
      workloads: [],
      rules: [],
      suspendedRoutes: [],
      valid: {
        mainWizard: true,
        vsHosts: true,
        tls: true,
        lb: true,
        gateway: true
      },
      advancedOptionsValid: true,
      vsHosts: [props.serviceName],
      trafficPolicy: {
        tlsModified: false,
        mtlsMode: DISABLE,
        addLoadBalancer: false,
        simpleLB: false,
        consistentHashType: ConsistentHashType.HTTP_HEADER_NAME,
        loadBalancer: {
          simple: ROUND_ROBIN
        }
      }
    };
  }

  componentDidUpdate(prevProps: WizardProps) {
    if (prevProps.show !== this.props.show || !this.compareWorkloads(prevProps.workloads, this.props.workloads)) {
      let isMainWizardValid: boolean;
      switch (this.props.type) {
        // By default the rule of Weighted routing should be valid
        case WIZARD_WEIGHTED_ROUTING:
          isMainWizardValid = true;
          break;
        // By default no rules is a no valid scenario
        case WIZARD_MATCHING_ROUTING:
          isMainWizardValid = false;
          break;
        case WIZARD_SUSPEND_TRAFFIC:
        default:
          isMainWizardValid = true;
          break;
      }
      const initVsHosts = getInitHosts(this.props.virtualServices);
      const initMtlsMode = getInitTlsMode(this.props.destinationRules);
      const initLoadBalancer = getInitLoadBalancer(this.props.destinationRules);
      let initConsistentHashType = ConsistentHashType.HTTP_HEADER_NAME;
      if (initLoadBalancer && initLoadBalancer.consistentHash) {
        if (initLoadBalancer.consistentHash.httpHeaderName) {
          initConsistentHashType = ConsistentHashType.HTTP_HEADER_NAME;
        } else if (initLoadBalancer.consistentHash.httpCookie) {
          initConsistentHashType = ConsistentHashType.HTTP_COOKIE;
        } else if (initLoadBalancer.consistentHash.useSourceIp) {
          initConsistentHashType = ConsistentHashType.USE_SOURCE_IP;
        }
      }
      const trafficPolicy: TrafficPolicyState = {
        tlsModified: initMtlsMode !== '',
        mtlsMode: initMtlsMode !== '' ? initMtlsMode : DISABLE,
        addLoadBalancer: initLoadBalancer !== undefined,
        simpleLB: initLoadBalancer !== undefined && initLoadBalancer.simple !== undefined,
        consistentHashType: initConsistentHashType,
        loadBalancer: initLoadBalancer
          ? initLoadBalancer
          : {
              simple: ROUND_ROBIN
            }
      };
      this.setState({
        showWizard: this.props.show,
        workloads: [],
        rules: [],
        valid: {
          mainWizard: isMainWizardValid,
          vsHosts: true,
          tls: true,
          lb: true,
          gateway: true
        },
        vsHosts:
          initVsHosts.length > 1 || (initVsHosts.length === 1 && initVsHosts[0].length > 0)
            ? initVsHosts
            : [this.props.serviceName],
        trafficPolicy: trafficPolicy
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

  onClose = () => {
    this.setState({
      showWizard: false
    });
    this.props.onClose(false);
  };

  onCreateUpdate = () => {
    const promises: Promise<Response<string>>[] = [];
    switch (this.props.type) {
      case WIZARD_WEIGHTED_ROUTING:
      case WIZARD_MATCHING_ROUTING:
      case WIZARD_SUSPEND_TRAFFIC:
        const [dr, vs, gw] = buildIstioConfig(this.props, this.state);
        // Gateway is only created when user has explicit selected this option
        if (gw) {
          promises.push(API.createIstioConfigDetail(this.props.namespace, 'gateways', JSON.stringify(gw)));
        }
        if (this.props.update) {
          promises.push(
            API.updateIstioConfigDetail(this.props.namespace, 'destinationrules', dr.metadata.name, JSON.stringify(dr))
          );
          promises.push(
            API.updateIstioConfigDetail(this.props.namespace, 'virtualservices', vs.metadata.name, JSON.stringify(vs))
          );
          // Note that Gateways are not updated from the Wizard, only the VS hosts/gateways sections are updated
        } else {
          promises.push(API.createIstioConfigDetail(this.props.namespace, 'destinationrules', JSON.stringify(dr)));
          promises.push(API.createIstioConfigDetail(this.props.namespace, 'virtualservices', JSON.stringify(vs)));
        }
        break;
      case WIZARD_THREESCALE_INTEGRATION:
        if (this.state.threeScaleServiceRule) {
          if (this.props.update) {
            promises.push(
              API.updateThreeScaleServiceRule(
                this.props.namespace,
                this.props.serviceName,
                JSON.stringify(this.state.threeScaleServiceRule)
              )
            );
          } else {
            promises.push(
              API.createThreeScaleServiceRule(this.props.namespace, JSON.stringify(this.state.threeScaleServiceRule))
            );
          }
        }
        break;
      default:
    }
    // Disable button before promise is completed. Then Wizard is closed.
    this.setState(prevState => {
      prevState.valid.mainWizard = false;
      return {
        valid: prevState.valid
      };
    });
    Promise.all(promises)
      .then(results => {
        if (results.length > 0) {
          MessageCenter.add(
            'Istio Config ' +
              (this.props.update ? 'updated' : 'created') +
              ' for ' +
              this.props.serviceName +
              ' service.',
            'default',
            MessageType.SUCCESS
          );
        }
        this.props.onClose(true);
      })
      .catch(error => {
        MessageCenter.add(
          API.getErrorMsg('Could not ' + (this.props.update ? 'update' : 'create') + ' Istio config objects.', error)
        );
        this.props.onClose(true);
      });
  };

  onVsHosts = (valid: boolean, vsHosts: string[]) => {
    this.setState(prevState => {
      prevState.valid.vsHosts = valid;
      return {
        valid: prevState.valid,
        vsHosts: vsHosts
      };
    });
  };

  onTrafficPolicy = (valid: boolean, trafficPolicy: TrafficPolicyState) => {
    this.setState(prevState => {
      // At the moment this callback only updates the valid of the loadbalancer
      // tls is always true, but I maintain it on the structure for consistency
      prevState.valid.lb = valid;
      return {
        valid: prevState.valid,
        trafficPolicy: trafficPolicy
      };
    });
  };

  onGateway = (valid: boolean, gateway: GatewaySelectorState) => {
    this.setState(prevState => {
      prevState.valid.gateway = valid;
      return {
        valid: prevState.valid,
        gateway: gateway
      };
    });
  };

  onWeightsChange = (valid: boolean, workloads: WorkloadWeight[]) => {
    this.setState(prevState => {
      prevState.valid.mainWizard = valid;
      return {
        valid: prevState.valid,
        workloads: workloads
      };
    });
  };

  onRulesChange = (valid: boolean, rules: Rule[]) => {
    this.setState(prevState => {
      prevState.valid.mainWizard = valid;
      return {
        valid: prevState.valid,
        rules: rules
      };
    });
  };

  onSuspendedChange = (valid: boolean, suspendedRoutes: SuspendedRoute[]) => {
    this.setState(prevState => {
      prevState.valid.mainWizard = valid;
      return {
        valid: prevState.valid,
        suspendedRoutes: suspendedRoutes
      };
    });
  };

  onThreeScaleChange = (valid: boolean, threeScaleServiceRule: ThreeScaleServiceRule) => {
    this.setState(prevState => {
      prevState.valid.mainWizard = valid;
      return {
        valid: prevState.valid,
        threeScaleServiceRule: threeScaleServiceRule
      };
    });
  };

  isValid = (state: WizardState): boolean => {
    return state.valid.mainWizard && state.valid.vsHosts && state.valid.tls && state.valid.lb && state.valid.gateway;
  };

  render() {
    const [gatewaySelected, isMesh] = getInitGateway(this.props.virtualServices);
    return (
      <Wizard
        show={this.state.showWizard}
        onHide={this.onClose}
        onKeyPress={e => {
          if (e.key === 'Enter' && this.isValid(this.state)) {
            this.onCreateUpdate();
          }
        }}
      >
        <Wizard.Header
          onClose={this.onClose}
          title={this.props.update ? WIZARD_UPDATE_TITLES[this.props.type] : WIZARD_TITLES[this.props.type]}
        />
        <Wizard.Body>
          <Wizard.Row>
            <Wizard.Main>
              <Wizard.Contents stepIndex={0} activeStepIndex={0}>
                {this.props.type === WIZARD_WEIGHTED_ROUTING && (
                  <WeightedRouting
                    serviceName={this.props.serviceName}
                    workloads={this.props.workloads}
                    initWeights={getInitWeights(this.props.workloads, this.props.virtualServices)}
                    onChange={this.onWeightsChange}
                  />
                )}
                {this.props.type === WIZARD_MATCHING_ROUTING && (
                  <MatchingRouting
                    serviceName={this.props.serviceName}
                    workloads={this.props.workloads}
                    initRules={getInitRules(this.props.workloads, this.props.virtualServices)}
                    onChange={this.onRulesChange}
                  />
                )}
                {this.props.type === WIZARD_SUSPEND_TRAFFIC && (
                  <SuspendTraffic
                    serviceName={this.props.serviceName}
                    workloads={this.props.workloads}
                    initSuspendedRoutes={getInitSuspendedRoutes(this.props.workloads, this.props.virtualServices)}
                    onChange={this.onSuspendedChange}
                  />
                )}
                {this.props.type === WIZARD_THREESCALE_INTEGRATION && (
                  <ThreeScaleIntegration
                    serviceName={this.props.serviceName}
                    serviceNamespace={this.props.namespace}
                    threeScaleServiceRule={
                      this.props.threeScaleServiceRule || {
                        serviceName: this.props.serviceName,
                        serviceNamespace: this.props.namespace,
                        threeScaleHandlerName: ''
                      }
                    }
                    onChange={this.onThreeScaleChange}
                  />
                )}
                {(this.props.type === WIZARD_WEIGHTED_ROUTING ||
                  this.props.type === WIZARD_MATCHING_ROUTING ||
                  this.props.type === WIZARD_SUSPEND_TRAFFIC) && (
                  <ExpandCollapse
                    className={expandStyle}
                    textCollapsed="Show Advanced Options"
                    textExpanded="Hide Advanced Options"
                    expanded={false}
                  >
                    <VirtualServiceHosts vsHosts={this.state.vsHosts} onVsHostsChange={this.onVsHosts} />
                    <TrafficPolicyContainer
                      mtlsMode={this.state.trafficPolicy.mtlsMode}
                      hasLoadBalancer={this.state.trafficPolicy.addLoadBalancer}
                      loadBalancer={this.state.trafficPolicy.loadBalancer}
                      nsWideStatus={this.props.tlsStatus}
                      onTrafficPolicyChange={this.onTrafficPolicy}
                    />
                    <GatewaySelector
                      serviceName={this.props.serviceName}
                      hasGateway={hasGateway(this.props.virtualServices)}
                      gateway={gatewaySelected}
                      isMesh={isMesh}
                      gateways={this.props.gateways}
                      onGatewayChange={this.onGateway}
                    />
                  </ExpandCollapse>
                )}
              </Wizard.Contents>
            </Wizard.Main>
          </Wizard.Row>
        </Wizard.Body>
        <Wizard.Footer>
          <Button bsStyle="default" className="btn-cancel" onClick={this.onClose}>
            Cancel
          </Button>
          <Button disabled={!this.isValid(this.state)} bsStyle="primary" onClick={this.onCreateUpdate}>
            {this.props.update ? 'Update' : 'Create'}
          </Button>
        </Wizard.Footer>
      </Wizard>
    );
  }
}

export default IstioWizard;
