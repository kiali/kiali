import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import {
  ServiceInfoDeployments,
  ServiceInfoRouteRules,
  ServiceInfoRoutes,
  ServiceInfoDescription
} from './ServiceInfo/';
import { Endpoints, Deployment, Port, RouteRule, DestinationPolicy } from '../../types/ServiceInfo';
import Health from '../../types/Health';
import * as API from '../../services/Api';
import { ToastNotification, ToastNotificationList, Col, Row } from 'patternfly-react';
import ServiceInfoDestinationPolicies from './ServiceInfo/ServiceInfoDestinationPolicies';

type ServiceInfoState = {
  labels?: Map<string, string>;
  type: string;
  name: string;
  ip: string;
  ports?: Port[];
  endpoints?: Endpoints[];
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
      deployments: [],
      routeRules: [],
      dependencies: new Map(),
      error: false,
      errorMessage: ''
    };
  }

  componentWillMount() {
    this.fetchServiceDetails(this.props);
    this.fetchHealth(this.props);
  }

  componentWillReceiveProps(nextProps: ServiceId) {
    this.fetchServiceDetails(nextProps);
    this.fetchHealth(nextProps);
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
          deployments: data.deployments,
          dependencies: data.dependencies,
          routeRules: data.route_rules,
          destinationPolicies: data.destination_policies,
          ip: data.ip
        });
      })
      .catch(error => {
        this.setState({
          error: true,
          errorMessage: 'Could not connect to server'
        });
        console.log(error);
      });
  }

  fetchHealth(props: ServiceId) {
    // Health
    API.getServiceHealth(props.namespace, props.service)
      .then(response => {
        this.setState({
          health: response['data']
        });
      })
      .catch(error => {
        this.setState({
          health: undefined,
          error: true,
          errorMessage: 'Could not fetch service health'
        });
        console.error(error);
      });
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
