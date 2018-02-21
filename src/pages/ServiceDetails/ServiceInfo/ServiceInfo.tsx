import * as React from 'react';
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
    console.log('Fetching info of a service...');
    API.GetServiceDetail(this.props.namespace, this.props.service)
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
            <Col xs={12} sm={12} md={12} lg={12}>
              <ServiceInfoCard
                iconType="pf"
                iconName="service"
                title={this.state.name}
                items={
                  <Row>
                    <Col xs={12} sm={6} md={6} lg={6}>
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
                      <div className="progress-description">
                        <strong>Type</strong> {this.state ? this.state.type : ''} <strong> Ip</strong>{' '}
                        {this.state ? this.state.ip : ''}
                      </div>
                    </Col>
                    <Col xs={12} sm={6} md={6} lg={6}>
                      <div className="progress-description">
                        <strong>Ports</strong>
                      </div>
                      {(this.state.ports || []).map((port, i) => (
                        <span style={{ marginLeft: '10px' }} key={'port_' + i}>
                          {port.protocol} {port.name} ({port.port})
                        </span>
                      ))}
                    </Col>
                    <Col xs={12} sm={6} md={12} lg={12}>
                      <hr />
                      <div className="progress-description">
                        <strong>Endpoints</strong>
                      </div>
                      {(this.state.endpoints || []).map((endpoint, i) => (
                        <Row key={'endpoint_' + i}>
                          <Col xs={12} sm={6} md={6} lg={6}>
                            <ul>
                              <li style={{ listStyleType: 'none' }}>Addresses</li>
                              <ul>
                                {(endpoint.addresses || []).map((address, u) => (
                                  <li key={'endpoint_' + i + '_address_' + u}>
                                    {address.name} ({address.ip})
                                  </li>
                                ))}
                              </ul>
                            </ul>
                          </Col>
                          <Col xs={12} sm={6} md={6} lg={6}>
                            <ul>
                              <li style={{ listStyleType: 'none' }}>Ports</li>
                              <ul>
                                {(endpoint.ports || []).map((port, u) => (
                                  <li key={'endpoint_' + i + '_port_' + u}>
                                    {port.protocol} {port.name} ({port.port})
                                  </li>
                                ))}
                              </ul>
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
                    <div className="progress-description">{pod['Name']}</div>
                    {Object.keys(pod.labels || new Map()).map((key, i) => (
                      <ServiceInfoBadge
                        key={'pod_labels_badge_' + i}
                        scale={0.8}
                        style="plastic"
                        color="green"
                        leftText={key}
                        rightText={pod.labels ? pod.labels[key] : ''}
                      />
                    ))}
                  </div>
                ))}
              />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoCard
                iconType="pf"
                iconName="route"
                title="Dependencies"
                items={Object.keys(this.state.dependencies || new Map()).map((key, u) => (
                  <div key={'dependencies_' + u}>
                    <div className="progress-description">{key}</div>
                    <ul>
                      {(this.state.dependencies ? this.state.dependencies[key] : []).map((dependency, i) => (
                        <li key={'dependencies_' + u + '_dependency_' + i}>{dependency}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              />
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <ServiceInfoCard
                iconType="pf"
                iconName="settings"
                title="Services Source"
                items={(this.state.rules || []).map((rule, i) => (
                  <ul style={{ listStyleType: 'none' }} key={'rule' + i}>
                    <li>
                      <strong>Destination</strong> : {rule.destination ? rule.destination['name'] : ''}
                    </li>
                    <li>
                      <strong>Precendence</strong> :{rule.precedence}
                    </li>
                    <li>
                      <strong>Route</strong>:
                      <ul>
                        {(rule.route || []).map((label, u) =>
                          Object.keys(label.labels || new Map()).map((key, n) => (
                            <li key={'rule_' + i + '_label_' + u + '_n_' + n}>
                              {key} : {label.labels[key]}
                            </li>
                          ))
                        )}
                      </ul>
                    </li>
                    {<hr />}
                  </ul>
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
