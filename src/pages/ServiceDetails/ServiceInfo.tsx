import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import ServiceInfoDescription from './ServiceInfo/ServiceInfoDescription';
import ServiceInfoDeployments from './ServiceInfo/ServiceInfoDeployments';
import ServiceInfoRouteRules from './ServiceInfo/ServiceInfoRouteRules';
import ServiceInfoRoutes from './ServiceInfo/ServiceInfoRoutes';
import ServiceInfoDestinationPolicies from './ServiceInfo/ServiceInfoDestinationPolicies';
import { Endpoints, Deployment, Port, RouteRule, DestinationPolicy, HasIstioSidecar } from '../../types/ServiceInfo';
import { Health } from '../../types/Health';
import * as API from '../../services/Api';
import { ToastNotification, ToastNotificationList, Col, Row } from 'patternfly-react';

type ServiceInfoState = {
  labels?: Map<string, string>;
  type: string;
  name: string;
  ip: string;
  ports?: Port[];
  endpoints?: Endpoints[];
  istio_sidecar: boolean;
  deployments?: Deployment[];
  routeRules?: RouteRule[];
  destinationPolicies?: DestinationPolicy[];
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

  componentDidMount() {
    this.fetchServiceDetails(this.props);
  }

  componentWillReceiveProps(nextProps: ServiceId) {
    this.fetchServiceDetails(nextProps);
  }

  fetchServiceDetails(props: ServiceId) {
    console.log('Fetching info of a service...');
    API.GetServiceDetail(props.namespace, props.service)
      .then(response => {
        let data = response['data'];
        this.setState({
          labels: data.labels,
          name: data.name,
          type: data.type,
          ports: data.ports,
          endpoints: data.endpoints,
          istio_sidecar: HasIstioSidecar(data.deployments),
          deployments: data.deployments,
          dependencies: data.dependencies,
          routeRules: this.sortRouteRulesByPrecedence(data.route_rules),
          destinationPolicies: data.destination_policies,
          ip: data.ip,
          health: data.health
        });
      })
      .catch(error => {
        this.setState({
          error: true,
          errorMessage: API.GetErrorMsg('Could not fetch Service Details.', error)
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

  render() {
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
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoDeployments deployments={this.state.deployments} />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoRoutes dependencies={this.state.dependencies} />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoRouteRules routeRules={this.state.routeRules} />
              <ServiceInfoDestinationPolicies destinationPolicies={this.state.destinationPolicies} />
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default ServiceInfo;
