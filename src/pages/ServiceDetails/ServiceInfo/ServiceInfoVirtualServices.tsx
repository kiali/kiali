import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import { VirtualService } from '../../../types/ServiceInfo';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';

interface ServiceInfoVirtualServicesProps {
  virtualServices?: VirtualService[];
}

class ServiceInfoVirtualServices extends React.Component<ServiceInfoVirtualServicesProps> {
  constructor(props: ServiceInfoVirtualServicesProps) {
    super(props);
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.props.virtualServices || []).map((virtualService, i) => (
              <div className="card-pf-body" key={'virtualService' + i}>
                <div>
                  <strong>Name</strong>: {virtualService.name}
                </div>
                <div>
                  <strong>Created at</strong>: <LocalTime time={virtualService.created_at} />
                </div>
                <div>
                  <strong>Resource Version</strong>: {virtualService.resource_version}
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
                {virtualService.http && virtualService.http.length > 0 ? (
                  <DetailObject name="Http Routes" detail={virtualService.http} />
                ) : (
                  undefined
                )}
                {virtualService.tcp && virtualService.tcp.length > 0 ? (
                  <DetailObject name="Tcp Routes" detail={virtualService.tcp} />
                ) : (
                  undefined
                )}
                <hr />
              </div>
            ))}
          </Col>
        </Row>
      </div>
    );
  }
}

export default ServiceInfoVirtualServices;
