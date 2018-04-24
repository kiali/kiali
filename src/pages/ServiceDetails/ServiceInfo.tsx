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
  hasIstioSidecar,
  VirtualService,
  DestinationRule
} from '../../types/ServiceInfo';
import { Health } from '../../types/Health';
import * as API from '../../services/Api';
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

class ServiceInfo extends React.Component<ServiceId, ServiceInfoState> {
  constructor(props: ServiceId) {
    super(props);
    this.state = {
      labels: new Map(),
      name: '',
      created_at: '',
      resource_version: '',
      type: '',
      ip: '',
      ports: [],
      istio_sidecar: false,
      deployments: [],
      routeRules: [],
      dependencies: new Map(),
      error: false,
      errorMessage: ''
    };
  }

  componentWillReceiveProps(nextProps: ServiceId) {
    this.fetchServiceDetails(nextProps);
  }

  fetchServiceDetails(props: ServiceId) {
    API.getServiceDetail(props.namespace, props.service)
      .then(response => {
        let data = response['data'];
        this.setState({
          labels: data.labels,
          name: data.name,
          created_at: data.created_at,
          resource_version: data.resource_version,
          type: data.type,
          ports: data.ports,
          endpoints: data.endpoints,
          istio_sidecar: hasIstioSidecar(data.deployments),
          deployments: data.deployments,
          dependencies: data.dependencies,
          routeRules: this.sortRouteRulesByPrecedence(data.route_rules),
          destinationPolicies: data.destination_policies,
          virtualServices: data.virtual_services,
          destinationRules: data.destination_rules,
          ip: data.ip,
          health: data.health
        });
      })
      .catch(error => {
        this.setState({
          error: true,
          errorMessage: API.getErrorMsg('Could not fetch Service Details.', error)
        });
        console.log(error);
      });
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

  calculateColumns(items: boolean[]) {
    let cells = 0;
    items.forEach(v => (v ? cells++ : v));
    let candidate = Number(12 / cells);
    return candidate * cells > 12 ? candidate - 1 : candidate;
  }

  render() {
    let deployments = this.state.deployments || [];
    let dependencies = this.state.dependencies || new Map();
    let routeRules = this.state.routeRules || [];
    let destinationPolicies = this.state.destinationPolicies || [];
    let virtualServices = this.state.virtualServices || [];
    let destinationRules = this.state.destinationRules || [];
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
              <TabContainer id="service-tabs" defaultActiveKey={101}>
                <div>
                  <Nav bsClass="nav nav-tabs nav-tabs-pf">
                    <NavItem eventKey={101}>{'Deployments (' + deployments.length + ')'}</NavItem>
                    <NavItem eventKey={102}>{'Source Services (' + Object.keys(dependencies).length + ')'}</NavItem>
                    <NavItem eventKey={103}>{'Route Rules (' + routeRules.length + ')'}</NavItem>
                    <NavItem eventKey={104}>{'Destination Policies (' + destinationPolicies.length + ')'}</NavItem>
                    <NavItem eventKey={105}>{'Virtual Services (' + virtualServices.length + ')'}</NavItem>
                    <NavItem eventKey={106}>{'Destination Rules (' + destinationRules.length + ')'}</NavItem>
                  </Nav>
                  <TabContent>
                    <TabPane eventKey={101}>
                      {(deployments.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoDeployments deployments={deployments} />
                      )}
                    </TabPane>
                    <TabPane eventKey={102}>
                      {(dependencies.size > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoRoutes dependencies={dependencies} />
                      )}
                    </TabPane>
                    <TabPane eventKey={103}>
                      {(routeRules.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoRouteRules routeRules={routeRules} />
                      )}
                    </TabPane>
                    <TabPane eventKey={104}>
                      {(destinationPolicies.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoDestinationPolicies destinationPolicies={destinationPolicies} />
                      )}
                    </TabPane>
                    <TabPane eventKey={105}>
                      {(virtualServices.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoVirtualServices virtualServices={virtualServices} />
                      )}
                    </TabPane>
                    <TabPane eventKey={106}>
                      {(destinationRules.length > 0 || this.state.istio_sidecar) && (
                        <ServiceInfoDestinationRules destinationRules={destinationRules} />
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
