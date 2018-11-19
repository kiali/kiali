import * as React from 'react';
import { Col, Icon, Row } from 'patternfly-react';
import {
  checkForPath,
  globalChecks,
  highestSeverity,
  severityToColor,
  severityToIconName,
  validationToSeverity,
  VirtualService
} from '../../../../types/ServiceInfo';
import { ObjectValidation } from '../../../../types/IstioObjects';
import LocalTime from '../../../../components/Time/LocalTime';
import DetailObject from '../../../../components/Details/DetailObject';
import VirtualServiceRoute from './VirtualServiceRoute';
import { Link } from 'react-router-dom';

interface VirtualServiceProps {
  namespace: string;
  virtualService: VirtualService;
  validations: { [key: string]: ObjectValidation };
}

class VirtualServiceDetail extends React.Component<VirtualServiceProps> {
  constructor(props: VirtualServiceProps) {
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

  generateGatewaysList(gateways: string[]) {
    let childrenList: any = [];
    Object.keys(gateways).forEach((key, j) =>
      childrenList.push(
        <li key={'gateway_' + gateways[key] + '_' + j}>
          {gateways[key] === 'mesh' ? (
            gateways[key]
          ) : (
            <Link to={`/namespaces/${this.props.namespace}/istio/gateways/${gateways[key]}`}>{gateways[key]}</Link>
          )}
        </li>
      )
    );

    return (
      <div>
        <strong className="text-capitalize">Gateways</strong>
        <ul className={'details'}>{childrenList}</ul>
      </div>
    );
  }

  rawConfig(virtualService: VirtualService) {
    return (
      <div className="card-pf-body" key={'virtualServiceConfig'}>
        <h4>VirtualService: {virtualService.name}</h4>
        <div>{this.globalStatus(virtualService)}</div>
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
        {virtualService.gateways && virtualService.gateways.length > 0
          ? this.generateGatewaysList(virtualService.gateways)
          : undefined}
      </div>
    );
  }

  weights(virtualService: VirtualService) {
    return (
      <Row className="card-pf-body" key={'virtualServiceWeights'}>
        <Col>
          {virtualService.http && virtualService.http.length > 0 ? (
            <>
              <VirtualServiceRoute
                name={virtualService.name}
                kind="HTTP"
                routes={virtualService.http}
                validations={this.props.validations}
              />
            </>
          ) : (
            undefined
          )}
          {virtualService.tcp && virtualService.tcp.length > 0 ? (
            <>
              <VirtualServiceRoute
                name={virtualService.name}
                kind="TCP"
                routes={virtualService.tcp}
                validations={this.props.validations}
              />
            </>
          ) : (
            undefined
          )}
          {virtualService.tls && virtualService.tls.length > 0 ? (
            <>
              <VirtualServiceRoute
                name={virtualService.name}
                kind="TLS"
                routes={virtualService.tls}
                validations={this.props.validations}
              />
            </>
          ) : (
            undefined
          )}
        </Col>
      </Row>
    );
  }

  render() {
    return (
      <Row className="row-cards-pf">
        <Col xs={12} sm={12} md={3} lg={3}>
          {this.rawConfig(this.props.virtualService)}
        </Col>
        <Col xs={12} sm={12} md={9} lg={9}>
          {this.weights(this.props.virtualService)}
        </Col>
      </Row>
    );
  }
}

export default VirtualServiceDetail;
