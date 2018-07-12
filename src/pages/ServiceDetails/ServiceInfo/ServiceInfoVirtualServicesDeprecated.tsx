import * as React from 'react';
import { Col, Icon, Row } from 'patternfly-react';
import {
  checkForPath,
  EditorLink,
  globalChecks,
  highestSeverity,
  ObjectValidation,
  severityToColor,
  severityToIconName,
  validationToSeverity,
  VirtualService
} from '../../../types/ServiceInfo';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';
import { Link } from 'react-router-dom';
import VirtualServiceRoute from './ServiceInfoVirtualServices/VirtualServiceRoute';

interface ServiceInfoVirtualServicesProps extends EditorLink {
  virtualServices?: VirtualService[];
  validations: { [key: string]: ObjectValidation };
}

class ServiceInfoVirtualServices extends React.Component<ServiceInfoVirtualServicesProps> {
  constructor(props: ServiceInfoVirtualServicesProps) {
    super(props);
  }

  validation(virtualService: VirtualService): ObjectValidation {
    return this.props.validations[virtualService.name];
  }

  globalStatus(rule: VirtualService) {
    let validation = this.validation(rule);
    let checks = globalChecks(validation);
    let severity = validationToSeverity(validation);
    let iconName = severityToIconName(severity);
    let color = severityToColor(severity);
    let message = checks.map(check => check.message).join(',');

    if (!message.length) {
      if (validation && !validation.valid) {
        message = 'Not all checks passed!';
      }
    }

    if (message.length) {
      return (
        <div>
          <p style={{ color: color }}>
            <Icon type="pf" name={iconName} /> {message}
          </p>
        </div>
      );
    } else {
      return '';
    }
  }

  hostStatusMessage(virtualService: VirtualService) {
    let checks = checkForPath(this.validation(virtualService), 'spec/hosts');
    let severity = highestSeverity(checks);

    return {
      message: checks.map(check => check.message).join(','),
      icon: severityToIconName(severity),
      color: severityToColor(severity)
    };
  }

  rawConfig(virtualService: VirtualService, i: number) {
    return (
      <div className="card-pf-body" key={'virtualServiceConfig' + i}>
        <h3>{virtualService.name}</h3>
        <div>
          <Link to={this.props.editorLink + '?virtualservice=' + virtualService.name}>
            Show Yaml <Icon name="angle-double-right" />
          </Link>
          {this.globalStatus(virtualService)}
        </div>
        <div>
          <strong>Created at</strong>: <LocalTime time={virtualService.createdAt} />
        </div>
        <div>
          <strong>Resource Version</strong>: {virtualService.resourceVersion}
        </div>
        {virtualService.hosts && virtualService.hosts.length > 0 ? (
          <DetailObject
            name="Hosts"
            detail={virtualService.hosts}
            validation={this.hostStatusMessage(virtualService)}
          />
        ) : (
          undefined
        )}
        {virtualService.gateways && virtualService.gateways.length > 0 ? (
          <DetailObject name="Gateways" detail={virtualService.gateways} />
        ) : (
          undefined
        )}
      </div>
    );
  }

  weights(virtualService: VirtualService, i: number) {
    return (
      <Row className="card-pf-body" key={'virtualServiceWeights' + i}>
        <Col>
          {virtualService.http && virtualService.http.length > 0 ? (
            <Row>
              <VirtualServiceRoute
                name={virtualService.name}
                kind="HTTP"
                routes={virtualService.http}
                validations={this.props.validations}
              />
            </Row>
          ) : (
            undefined
          )}
          {virtualService.tcp && virtualService.tcp.length > 0 ? (
            <Row>
              <VirtualServiceRoute
                name={virtualService.name}
                kind="TCP"
                routes={virtualService.tcp}
                validations={this.props.validations}
              />
            </Row>
          ) : (
            undefined
          )}
        </Col>
      </Row>
    );
  }

  render() {
    return (
      <div className="card-pf">
        {(this.props.virtualServices || []).map((virtualService, i) => (
          <Row className={'row-cards-pf'} key={'virtualservice' + i}>
            <Row className="row-cards-pf">
              <Col xs={12} sm={12} md={3} lg={3}>
                {this.rawConfig(virtualService, i)}
              </Col>
              <Col xs={12} sm={12} md={9} lg={9}>
                {this.weights(virtualService, i)}
              </Col>
            </Row>
          </Row>
        ))}
      </div>
    );
  }
}

export default ServiceInfoVirtualServices;
