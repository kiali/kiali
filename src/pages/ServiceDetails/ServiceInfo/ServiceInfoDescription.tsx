import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import LocalTime from '../../../components/Time/LocalTime';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import { ServiceHealth } from '../../../types/Health';
import { Endpoints } from '../../../types/ServiceInfo';
import { Port } from '../../../types/IstioObjects';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import { style } from 'typestyle';

import './ServiceInfoDescription.css';
import Labels from '../../../components/Label/Labels';
import { CytoscapeGraphSelectorBuilder } from '../../../components/CytoscapeGraph/CytoscapeGraphSelector';
import { ThreeScaleServiceRule } from '../../../types/ThreeScale';

interface ServiceInfoDescriptionProps {
  name: string;
  namespace: string;
  createdAt: string;
  resourceVersion: string;
  istioEnabled?: boolean;
  labels?: { [key: string]: string };
  type?: string;
  ip?: any;
  externalName?: string;
  ports?: Port[];
  endpoints?: Endpoints[];
  health?: ServiceHealth;
  threeScaleServiceRule?: ThreeScaleServiceRule;
}

const listStyle = style({
  listStyleType: 'none',
  padding: 0
});

const ExternalNameType = 'ExternalName';

class ServiceInfoDescription extends React.Component<ServiceInfoDescriptionProps> {
  constructor(props: ServiceInfoDescriptionProps) {
    super(props);
  }

  showOnGraphLink(serviceName: string, namespace: string) {
    return `/graph/namespaces?graphType=service&injectServiceNodes=true&unusedNodes=true&focusSelector=${encodeURI(
      new CytoscapeGraphSelectorBuilder()
        .service(serviceName)
        .namespace(namespace)
        .build()
    )}`;
  }

  render() {
    return (
      <PfInfoCard
        iconType="pf"
        iconName="service"
        title={this.props.name}
        istio={this.props.istioEnabled}
        showOnGraphLink={this.showOnGraphLink(this.props.name, this.props.namespace)}
        items={
          <Row>
            <Col xs={12} sm={6} md={5} lg={5}>
              <div className="progress-description">
                <strong>Labels</strong>
              </div>
              <div className="label-collection">
                <Labels labels={this.props.labels || {}} />
              </div>
              <div>
                <strong>Type</strong> {this.props.type ? this.props.type : ''}
              </div>
              {this.props.type !== ExternalNameType ? (
                <div>
                  <strong>IP</strong> {this.props.ip ? this.props.ip : ''}
                </div>
              ) : (
                <div>
                  <strong>ExternalName</strong> {this.props.externalName ? this.props.externalName : ''}
                </div>
              )}
              <div>
                <strong>Created at</strong> <LocalTime time={this.props.createdAt} />
              </div>
              <div>
                <strong>Resource Version</strong> {this.props.resourceVersion}
              </div>
              {this.props.threeScaleServiceRule && this.props.threeScaleServiceRule.threeScaleHandlerName !== '' && (
                <span>
                  Service linked with 3scale API Handler <i>{this.props.threeScaleServiceRule.threeScaleHandlerName}</i>
                </span>
              )}
            </Col>
            <Col xs={12} sm={4} md={2} lg={2}>
              <div className="progress-description">
                <strong>Ports</strong>
              </div>
              <ul className={listStyle}>
                {(this.props.ports || []).map((port, i) => (
                  <li key={'port_' + i}>
                    {port.protocol} {port.name} ({port.port})
                  </li>
                ))}
              </ul>
            </Col>
            <Col xs={12} sm={6} md={2} lg={2}>
              <div className="progress-description">
                <strong>Endpoints</strong>
              </div>
              {(this.props.endpoints || []).map((endpoint, i) => (
                <Row key={'endpoint_' + i}>
                  <Col xs={12} sm={12} md={12} lg={12}>
                    <ul className={listStyle}>
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
            <Col xs={12} sm={6} md={3} lg={3}>
              <div className="progress-description">
                <strong>Health</strong>
              </div>
              <HealthIndicator
                id={this.props.name}
                health={this.props.health}
                mode={DisplayMode.LARGE}
                tooltipPlacement="left"
              />
            </Col>
          </Row>
        }
      />
    );
  }
}

export default ServiceInfoDescription;
