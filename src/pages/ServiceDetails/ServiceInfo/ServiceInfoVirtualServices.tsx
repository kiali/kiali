import * as React from 'react';
import { Col, Icon, Row } from 'patternfly-react';
import { EditorLink, ObjectValidation, VirtualService } from '../../../types/ServiceInfo';
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

  rawConfig(virtualService: VirtualService, i: number) {
    return (
      <div className="card-pf-body" key={'virtualServiceConfig' + i}>
        <h3>{virtualService.name}</h3>
        <div>
          <Link to={this.props.editorLink + '?virtualservice=' + virtualService.name}>
            Show Yaml <Icon name="angle-double-right" />
          </Link>
        </div>
        <div>
          <strong>Created at</strong>: <LocalTime time={virtualService.createdAt} />
        </div>
        <div>
          <strong>Resource Version</strong>: {virtualService.resourceVersion}
        </div>
        {virtualService.hosts && virtualService.hosts.length > 0 ? (
          <DetailObject name="Hosts" detail={virtualService.hosts} />
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
