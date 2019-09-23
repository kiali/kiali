import * as React from 'react';
import { Col, OverlayTrigger, Popover, Row, Tooltip } from 'patternfly-react';
import LocalTime from '../../../components/Time/LocalTime';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import { ServiceHealth } from '../../../types/Health';
import { Endpoints } from '../../../types/ServiceInfo';
import { ObjectCheck, ObjectValidation, Port } from '../../../types/IstioObjects';
import { style } from 'typestyle';
import { ValidationSummary } from '../../../components/Validations/ValidationSummary';
import './ServiceInfoDescription.css';
import Labels from '../../../components/Label/Labels';
import { ThreeScaleServiceRule } from '../../../types/ThreeScale';
import ValidationList from '../../../components/Validations/ValidationList';

interface ServiceInfoDescriptionProps {
  name: string;
  namespace: string;
  createdAt: string;
  resourceVersion: string;
  istioEnabled?: boolean;
  labels?: { [key: string]: string };
  selectors?: { [key: string]: string };
  type?: string;
  ip?: any;
  externalName?: string;
  ports?: Port[];
  endpoints?: Endpoints[];
  health?: ServiceHealth;
  threeScaleServiceRule?: ThreeScaleServiceRule;
  validations?: ObjectValidation;
}

const listStyle = style({
  listStyleType: 'none',
  padding: 0
});

const labelTitleStyle = style({
  marginBottom: '2px'
});

const labelListStyle = style({
  marginBottom: '4px'
});

const ExternalNameType = 'ExternalName';

class ServiceInfoDescription extends React.Component<ServiceInfoDescriptionProps> {
  getValidations(): ObjectValidation {
    return this.props.validations ? this.props.validations : ({} as ObjectValidation);
  }

  getPortOver(portId: number): Popover {
    return (
      <div style={{ float: 'left', fontSize: '12px', padding: '3px 0.6em 0 0' }}>
        <ValidationList checks={this.getPortChecks(portId)} />
      </div>
    );
  }

  getPortChecks(portId: number): ObjectCheck[] {
    return this.getValidations().checks.filter(c => c.path === 'spec/ports[' + portId + ']');
  }

  hasIssue(portId: number): boolean {
    return this.getPortChecks(portId).length > 0;
  }

  render() {
    return (
      <div className="card-pf">
        <div className="card-pf-body">
          <Row>
            <Col xs={12} sm={6} md={5} lg={5}>
              <div id="labels">
                <div className={'progress-description ' + labelTitleStyle}>
                  <strong>Labels</strong>
                </div>
                <div className={'label-collection ' + labelListStyle}>
                  <Labels labels={this.props.labels || {}} />
                </div>
              </div>
              <div id="selectors">
                <div className={'progress-description ' + labelTitleStyle}>
                  <strong>Selectors</strong>
                </div>
                <div className={'label-collection ' + labelListStyle}>
                  <Labels labels={this.props.selectors || {}} />
                </div>
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
                <ValidationSummary id={this.props.name + '-config-validation'} validations={[this.getValidations()]} />
                <strong style={{ margin: '0.1em 0 0 0.5em' }}>Ports</strong>
              </div>
              <ul className={listStyle}>
                {(this.props.ports || []).map((port, i) => (
                  <li key={'port_' + i}>
                    {this.hasIssue(i) ? this.getPortOver(i) : undefined}
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
                      {(endpoint.addresses || []).map((address, u) => {
                        const id = 'endpoint_' + i + '_address_' + u;
                        return (
                          <li key={id}>
                            <OverlayTrigger
                              overlay={<Tooltip id={id + '_tooltip'}>{address.name}</Tooltip>}
                              trigger={['hover', 'focus']}
                              rootClose={false}
                            >
                              <strong>{address.ip} </strong>
                            </OverlayTrigger>
                          </li>
                        );
                      })}
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
        </div>
      </div>
    );
  }
}

export default ServiceInfoDescription;
