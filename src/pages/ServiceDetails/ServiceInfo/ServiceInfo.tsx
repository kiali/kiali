import * as React from 'react';
import { Link } from 'react-router-dom';
import ServiceId from '../../../types/ServiceId';
import ServiceInfoBadge from './ServiceInfoBadge';
import ServiceInfoCard from './ServiceInfoCard';
import { Endpoints, Pod, Port, Source, Rule } from '../../../types/ServiceInfo';
import * as API from '../../../services/Api';
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
        console.log(response['data']);
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
              <ServiceInfoCard
                iconType="pf"
                iconName="service"
                title={this.state.name}
                items={
                  <Row>
                    <Col xs={12} sm={6} md={2} lg={2}>
                      <div className="progress-description">
                        <strong>Labels</strong>
                      </div>
                      {Object.keys(this.state.labels || new Map()).map((key, i) => (
                        <ServiceInfoBadge
                          key={'label_' + i}
                          scale={0.8}
                          style="plastic"
                          color="#0088ce"
                          leftText={key}
                          rightText={this.state.labels ? this.state.labels[key] : ''}
                        />
                      ))}
                      <div>
                        <strong>Type</strong> {this.state.type ? this.state.type : ''}
                      </div>
                      <div>
                        <strong> Ip</strong> {this.state.ip ? this.state.ip : ''}
                      </div>
                    </Col>
                    <Col xs={12} sm={6} md={4} lg={4}>
                      <div className="progress-description">
                        <strong>Ports</strong>
                      </div>
                      <ul style={{ listStyleType: 'none' }}>
                      {(this.state.ports || []).map((port, i) => (
                        <li key={'port_' + i}>
                          {port.protocol} {port.name} ({port.port})
                        </li>
                      ))}
                      </ul>
                    </Col>
                    <Col xs={12} sm={6} md={6} lg={6}>
                      <div className="progress-description">
                        <strong>Endpoints</strong>
                      </div>
                      {(this.state.endpoints || []).map((endpoint, i) => (
                        <Row key={'endpoint_' + i}>
                          <Col xs={12} sm={12} md={12} lg={12}>
                            <ul style={{ listStyleType: 'none' }}>
                              {(endpoint.addresses || []).map((address, u) => (
                                <li key={'endpoint_' + i + '_address_' + u}>
                                  <strong>{address.ip} </strong>: {address.name}
                                </li>
                              ))}
                            </ul>
                          </Col>
                        </Row>
                      ))}
                    </Col>
                  </Row>
                }
              />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoCard
                iconType="fa"
                iconName="cube"
                title="Pods"
                items={(this.state.pods || []).map((pod, u) => (
                  <div key={'pods_' + u}>
                    <div>
                      <strong>Pod</strong>: {pod['name']}
                    </div>
                    <ul style={{ listStyleType: 'none' }}>
                      {Object.keys(pod.labels || new Map()).map((key, i) => (
                        <li>
                          <ServiceInfoBadge
                            key={'pod_labels_badge_' + i}
                            scale={0.8}
                            style="plastic"
                            color="green"
                            leftText={key}
                            rightText={pod.labels ? pod.labels[key] : ''}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoCard
                iconType="pf"
                iconName="route"
                title="Source Services"
                items={Object.keys(this.state.dependencies || new Map()).map((key, u) => (
                  <div key={'dependencies_' + u}>
                    <div className="progress-description">
                      <strong>To: </strong> {key}
                    </div>
                    <ul style={{ listStyleType: 'none' }}>
                      {(this.state.dependencies ? this.state.dependencies[key] : []).map((dependency, i) => {
                        let nVersion = dependency.indexOf('/');
                        let nNamespace = dependency.indexOf('.');
                        let servicename = dependency.substring(0, nNamespace);
                        let namespace = dependency.substring(nNamespace + 1, nVersion);
                        if (servicename.length > 0 && namespace.length > 0) {
                          let to = '/namespaces/' + namespace + '/services/' + servicename;
                          return (
                            <Link key={to} to={to}>
                              <li key={'dependencies_' + u + '_dependency_' + i}>{dependency}</li>
                            </Link>
                          );
                        } else {
                          return <li key={'dependencies_' + u + '_dependency_' + i}>{dependency}</li>;
                        }
                      })}
                    </ul>
                  </div>
                ))}
              />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoCard
                iconType="pf"
                iconName="settings"
                title="Istio Route Rules"
                items={(this.state.rules || []).map((rule, i) => (
                  <div key={'rule' + i}>
                    <div>
                      <strong>Name</strong> : {rule.name}
                    </div>
                    <div>
                      <strong>Precendence</strong> : {rule.precedence}
                    </div>
                    <div>
                      <strong>Route</strong>:
                      <ul style={{ listStyleType: 'none' }}>
                        {(rule.route || []).map((label, u) =>
                          Object.keys(label.labels || new Map()).map((key, n) => (
                            <li key={'rule_' + i + '_label_' + u + '_n_' + n}>
                              <ServiceInfoBadge
                                key={'rule_labels_badge_' + i}
                                scale={0.8}
                                style="plastic"
                                color="green"
                                leftText={key}
                                rightText={label.labels ? label.labels[key] : ''}
                              />
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                    <div>
                      {!rule.match ? null : (
                        <div>
                          <strong>Match</strong>:
                          <textarea className="form-control textarea-resize" readOnly={true}>
                            {JSON.stringify(rule.match, null, 2)}
                          </textarea>
                        </div>
                      )}
                    </div>
                    <hr />
                  </div>
                ))}
              />
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default ServiceInfo;
