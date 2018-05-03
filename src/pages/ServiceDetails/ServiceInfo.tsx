import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import ServiceInfoDescription from './ServiceInfo/ServiceInfoDescription';
import ServiceInfoDeployments from './ServiceInfo/ServiceInfoDeployments';
import ServiceInfoRouteRules from './ServiceInfo/ServiceInfoRouteRules';
import ServiceInfoRoutes from './ServiceInfo/ServiceInfoRoutes';
import ServiceInfoDestinationPolicies from './ServiceInfo/ServiceInfoDestinationPolicies';
import {
  Endpoints,
  Deployment,
  Port,
  RouteRule,
  DestinationPolicy,
  VirtualService,
  DestinationRule,
  ServiceDetailsInfo
} from '../../types/ServiceInfo';
import { Health } from '../../types/Health';
import {
  ToastNotification,
  ToastNotificationList,
  Col,
  Row,
  TabContainer,
  TabContent,
  TabPane,
  Nav,
  NavItem
} from 'patternfly-react';
import ServiceInfoVirtualServices from './ServiceInfo/ServiceInfoVirtualServices';
import ServiceInfoDestinationRules from './ServiceInfo/ServiceInfoDestinationRules';

interface ServiceDetailsId extends ServiceId {
  serviceDetails: ServiceDetailsInfo;
}

type ServiceInfoState = {
  labels?: Map<string, string>;
  type: string;
  name: string;
  created_at: string;
  resource_version: string;
  ip: string;
  ports?: Port[];
  endpoints?: Endpoints[];
  istio_sidecar: boolean;
  deployments?: Deployment[];
  routeRules?: RouteRule[];
  destinationPolicies?: DestinationPolicy[];
  virtualServices?: VirtualService[];
  destinationRules?: DestinationRule[];
  dependencies?: Map<string, string[]>;
  health?: Health;
  error: boolean;
  errorMessage: string;
};

class ServiceInfo extends React.Component<ServiceDetailsId, ServiceInfoState> {
  constructor(props: ServiceDetailsId) {
    super(props);
    this.state = this.parseState(props.serviceDetails);
  }

  parseState = serviceInfoDetails => {
    let parsed: ServiceInfoState = {
      labels: new Map(),
      type: serviceInfoDetails.type,
      name: serviceInfoDetails.name,
      created_at: serviceInfoDetails.created_at,
      resource_version: serviceInfoDetails.resource_version,
      ip: serviceInfoDetails.ip,
      ports: serviceInfoDetails.ports,
      endpoints: serviceInfoDetails.endpoints,
      istio_sidecar: serviceInfoDetails.istio_sidecar,
      deployments: serviceInfoDetails.deployments,
      routeRules: this.sortRouteRulesByPrecedence(serviceInfoDetails.routeRules || []),
      destinationPolicies: serviceInfoDetails.destinationPolicies,
      virtualServices: serviceInfoDetails.virtualServices,
      destinationRules: serviceInfoDetails.destinationRules,
      dependencies: serviceInfoDetails.dependencies,
      health: serviceInfoDetails.health,
      error: false,
      errorMessage: ''
    };
    return parsed;
  };

  componentWillReceiveProps(props: ServiceDetailsId) {
    this.setState(this.parseState(props.serviceDetails));
  }

  sortRouteRulesByPrecedence(routeRules: RouteRule[]) {
    let sorted: RouteRule[] = [];
    if (routeRules) {
      sorted = routeRules.sort((a: RouteRule, b: RouteRule) => {
        if (a.precedence && b.precedence) {
          return a.precedence < b.precedence ? 1 : -1;
        }
        return -1;
      });
    }
    return sorted;
  }

  render() {
    let deployments = this.state.deployments || [];
    let dependencies = this.state.dependencies || new Map();
    let routeRules = this.state.routeRules || [];
    let destinationPolicies = this.state.destinationPolicies || [];
    let virtualServices = this.state.virtualServices || [];
    let destinationRules = this.state.destinationRules || [];
    let editorLink = '/namespaces/' + this.props.namespace + '/services/' + this.props.service;
    return (
      <div>
        {this.state.error ? (
          <ToastNotificationList>
            <ToastNotification type="danger">
              <span>
                <strong>Error </strong>
                {this.state.errorMessage}
              </span>
            </ToastNotification>
          </ToastNotificationList>
        ) : null}
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <ServiceInfoDescription
                name={this.state.name}
                created_at={this.state.created_at}
                resource_version={this.state.resource_version}
                istio_sidecar={this.state.istio_sidecar}
                labels={this.state.labels}
                ports={this.state.ports}
                type={this.state.type}
                ip={this.state.ip}
                endpoints={this.state.endpoints}
                health={this.state.health}
              />
            </Col>
          </Row>
          <Row className="row-cards-pf">
            <Col xs={12} sm={12} md={12} lg={12}>
              <TabContainer id="service-tabs" defaultActiveKey={1}>
                <div>
                  <Nav bsClass="nav nav-tabs nav-tabs-pf">
                    <NavItem eventKey={1}>{'Deployments (' + deployments.length + ')'}</NavItem>
                    <NavItem eventKey={2}>{'Source Services (' + Object.keys(dependencies).length + ')'}</NavItem>
                    <NavItem eventKey={3}>{'Route Rules (' + routeRules.length + ')'}</NavItem>
                    <NavItem eventKey={4}>{'Destination Policies (' + destinationPolicies.length + ')'}</NavItem>
                    <NavItem eventKey={5}>{'Virtual Services (' + virtualServices.length + ')'}</NavItem>
                    <NavItem eventKey={6}>{'Destination Rules (' + destinationRules.length + ')'}</NavItem>
                  </Nav>
                  <TabContent>
                    <TabPane eventKey={1}>
                      {(deployments.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoDeployments deployments={deployments} />
                      )}
                    </TabPane>
                    <TabPane eventKey={2}>
                      {(dependencies.size > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoRoutes dependencies={dependencies} />
                      )}
                    </TabPane>
                    <TabPane eventKey={3}>
                      {(routeRules.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoRouteRules routeRules={routeRules} editorLink={editorLink} />
                      )}
                    </TabPane>
                    <TabPane eventKey={4}>
                      {(destinationPolicies.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoDestinationPolicies
                          destinationPolicies={destinationPolicies}
                          editorLink={editorLink}
                        />
                      )}
                    </TabPane>
                    <TabPane eventKey={5}>
                      {(virtualServices.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoVirtualServices virtualServices={virtualServices} editorLink={editorLink} />
                      )}
                    </TabPane>
                    <TabPane eventKey={6}>
                      {(destinationRules.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoDestinationRules destinationRules={destinationRules} editorLink={editorLink} />
                      )}
                    </TabPane>
                  </TabContent>
                </div>
              </TabContainer>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default ServiceInfo;
