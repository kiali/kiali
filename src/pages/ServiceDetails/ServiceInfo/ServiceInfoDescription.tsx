import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import LocalTime from '../../../components/Time/LocalTime';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import { ServiceHealth } from '../../../types/Health';
import { Endpoints } from '../../../types/ServiceInfo';
import { Port, ObjectValidation } from '../../../types/IstioObjects';
import { style } from 'typestyle';
import {
  ConfigIndicator,
  NOT_VALID,
  SMALL_SIZE,
  MEDIUM_SIZE
} from '../../../components/ConfigValidation/ConfigIndicator';
import { Popover, OverlayTrigger, Icon, Tooltip } from 'patternfly-react';
import './ServiceInfoDescription.css';
import Labels from '../../../components/Label/Labels';
import { ThreeScaleServiceRule } from '../../../types/ThreeScale';

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
      <Popover id={portId + '-config-validation'} title={NOT_VALID.name} style={{ maxWidth: '80%', minWidth: '200px' }}>
        <div>{this.getPortIssue(portId)}</div>
      </Popover>
    );
  }

  getPortIssue(portId: number): string {
    let message = '';
    if (this.props.validations && this.props.validations.checks) {
      message = this.props.validations.checks
        .filter(c => c.path === 'spec/ports[' + portId + ']')
        .map(c => c.message)
        .join(',');
    }
    return message;
  }

  hasIssue(portId: number): boolean {
    return this.getPortIssue(portId) !== '';
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
                <ConfigIndicator
                  id={this.props.name + '-config-validation'}
                  validations={[this.getValidations()]}
                  size={MEDIUM_SIZE}
                />
                <strong>Ports</strong>
              </div>
              <ul className={listStyle}>
                {(this.props.ports || []).map((port, i) => (
                  <li key={'port_' + i}>
                    {this.hasIssue(i) ? (
                      <OverlayTrigger
                        placement={'right'}
                        overlay={this.getPortOver(i)}
                        trigger={['hover', 'focus']}
                        rootClose={false}
                      >
                        <span style={{ color: NOT_VALID.color }}>
                          <Icon
                            type="pf"
                            name="error-circle-o"
                            style={{ fontSize: SMALL_SIZE }}
                            className="health-icon"
                            tabIndex="0"
                          />
                        </span>
                      </OverlayTrigger>
                    ) : (
                      undefined
                    )}
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
