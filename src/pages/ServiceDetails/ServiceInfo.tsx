import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import { ServiceInfoPods, ServiceInfoRules, ServiceInfoRoutes, ServiceInfoDescription } from './ServiceInfo/';
import { Endpoints, Pod, Port, Source, Rule } from '../../types/ServiceInfo';
import * as API from '../../services/Api';
import { ToastNotification, ToastNotificationList, Col, Row } from 'patternfly-react';

type ServiceInfoState = {
  labels?: Map<string, string>;
  type: string;
  name: string;
  ip: string;
  ports?: Port[];
  endpoints?: Endpoints[];
  pods?: Pod[];
  rules?: Rule[];
  dependencies?: Source[];
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
      pods: [],
      rules: [],
      dependencies: [],
      error: false,
      errorMessage: ''
    };
  }

  componentWillMount() {
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
          pods: data.pods,
          dependencies: data.dependencies,
          rules: data.route_rules,
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
            <Col>
              <ServiceInfoDescription
                name={this.state.name}
                labels={this.state.labels}
                ports={this.state.ports}
                type={this.state.type}
                ip={this.state.ip}
                endpoints={this.state.endpoints}
              />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoPods pods={this.state.pods} />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoRoutes dependencies={this.state.dependencies} />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoRules rules={this.state.rules} />
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default ServiceInfo;
