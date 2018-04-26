import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import { DestinationPolicy } from '../../../types/ServiceInfo';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';

interface ServiceInfoDestinationPoliciesProps {
  destinationPolicies?: DestinationPolicy[];
}

class ServiceInfoDestinationPolicies extends React.Component<ServiceInfoDestinationPoliciesProps> {
  constructor(props: ServiceInfoDestinationPoliciesProps) {
    super(props);
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.props.destinationPolicies || []).map((dPolicy, i) => {
              return (
                <div className="card-pf-body" key={'rule' + i}>
                  <div>
                    <strong>Name</strong>
                    {': '}
                    {dPolicy.name}
                  </div>
                  <div>
                    <strong>Created at</strong>
                    {': '}
                    <LocalTime time={dPolicy.created_at} />
                  </div>
                  <div>
                    <strong>Resource Version</strong>
                    {': '}
                    {dPolicy.resource_version}
                  </div>
                  {dPolicy.destination ? (
                    <DetailObject name="Destination" detail={dPolicy.destination} labels={['labels']} />
                  ) : null}
                  {dPolicy.source ? <DetailObject name="Source" detail={dPolicy.source} labels={['labels']} /> : null}
                  {dPolicy.loadbalancing ? <DetailObject name="LoadBalancing" detail={dPolicy.loadbalancing} /> : null}
                  {dPolicy.circuitBreaker ? (
                    <DetailObject name="CircuitBreaker" detail={dPolicy.circuitBreaker} />
                  ) : null}
                  <hr />
                </div>
              );
            })}
          </Col>
        </Row>
      </div>
    );
  }
}

export default ServiceInfoDestinationPolicies;
