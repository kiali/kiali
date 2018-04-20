import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import ServiceInfoDescription from './ServiceInfo/ServiceInfoDescription';
import ServiceInfoDeployments from './ServiceInfo/ServiceInfoDeployments';
import ServiceInfoRouteRules from './ServiceInfo/ServiceInfoRouteRules';
import ServiceInfoRoutes from './ServiceInfo/ServiceInfoRoutes';
import ServiceInfoDestinationPolicies from './ServiceInfo/ServiceInfoDestinationPolicies';
import { Endpoints, Deployment, Port, RouteRule, DestinationPolicy, hasIstioSidecar } from '../../types/ServiceInfo';
import { Health } from '../../types/Health';
import * as API from '../../services/Api';
import { ToastNotification, ToastNotificationList, Col, Row } from 'patternfly-react';

type ServiceInfoState = {
  labels?: Map<string, string>;
  type: string;
  name: string;
  created_at: string;
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
      created_at: '',
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
    API.getServiceDetail(props.namespace, props.service)
      .then(response => {
        let data = response['data'];
        this.setState({
          labels: data.labels,
          name: data.name,
          created_at: data.created_at,
          type: data.type,
          ports: data.ports,
          endpoints: data.endpoints,
          istio_sidecar: hasIstioSidecar(data.deployments),
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
    let cWidth = this.calculateColumns([
      deployments.length > 0,
      dependencies.size > 0,
      routeRules.length > 0 || destinationPolicies.length > 0
    ]);
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
            {(deployments.length > 0 || this.state.istio_sidecar) && (
              <Col xs={12} sm={12} md={cWidth} lg={cWidth}>
                <ServiceInfoDeployments deployments={deployments} />
              </Col>
            )}
            {(dependencies.size > 0 || this.state.istio_sidecar) && (
              <Col xs={12} sm={6} md={cWidth} lg={cWidth}>
                <ServiceInfoRoutes dependencies={dependencies} />
              </Col>
            )}
            {(routeRules.length > 0 || destinationPolicies.length > 0 || this.state.istio_sidecar) && (
              <Col xs={12} sm={6} md={cWidth} lg={cWidth}>
                {(routeRules.length > 0 || this.state.istio_sidecar) && (
                  <ServiceInfoRouteRules routeRules={routeRules} />
                )}
                {(destinationPolicies.length > 0 || this.state.istio_sidecar) && (
                  <ServiceInfoDestinationPolicies destinationPolicies={destinationPolicies} />
                )}
              </Col>
            )}
          </Row>
        </div>
      </div>
    );
  }
}

export default ServiceInfo;
