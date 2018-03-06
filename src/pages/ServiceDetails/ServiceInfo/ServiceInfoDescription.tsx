import * as React from 'react';
import ServiceInfoBadge from './ServiceInfoBadge';
import ServiceInfoCard from './ServiceInfoCard';
import { Col, Row } from 'patternfly-react';
import { Endpoints, Port } from '../../../types/ServiceInfo';

interface ServiceInfoDescriptionProps {
  name?: string;
  labels?: Map<string, string>;
  type?: string;
  ip?: any;
  ports?: Port[];
  endpoints?: Endpoints[];
}

class ServiceInfoDescription extends React.Component<ServiceInfoDescriptionProps> {
  constructor(props: ServiceInfoDescriptionProps) {
    super(props);
  }

  render() {
    return (
      <ServiceInfoCard
        iconType="pf"
        iconName="service"
        title={this.props.name}
        items={
          <Row>
            <Col xs={12} sm={6} md={2} lg={2}>
              <div className="progress-description">
                <strong>Labels</strong>
              </div>
              {Object.keys(this.props.labels || new Map()).map((key, i) => (
                <div key={'label_' + i}>
                  <ServiceInfoBadge
                    scale={0.8}
                    style="plastic"
                    color="#0088ce"
                    leftText={key}
                    rightText={this.props.labels ? this.props.labels[key] : ''}
                  />
                </div>
              ))}
              <div>
                <strong>Type</strong> {this.props.type ? this.props.type : ''}
              </div>
              <div>
                <strong> Ip</strong> {this.props.ip ? this.props.ip : ''}
              </div>
            </Col>
            <Col xs={12} sm={6} md={4} lg={4}>
              <div className="progress-description">
                <strong>Ports</strong>
              </div>
              <ul style={{ listStyleType: 'none' }}>
                {(this.props.ports || []).map((port, i) => (
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
              {(this.props.endpoints || []).map((endpoint, i) => (
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
    );
  }
}

export default ServiceInfoDescription;
