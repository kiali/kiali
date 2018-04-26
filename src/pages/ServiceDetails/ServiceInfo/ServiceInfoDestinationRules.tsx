import * as React from 'react';
import { DestinationRule } from '../../../types/ServiceInfo';
import { Col, Row } from 'patternfly-react';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';

interface ServiceInfoDestinationRulesProps {
  destinationRules?: DestinationRule[];
}

class ServiceInfoDestinationRules extends React.Component<ServiceInfoDestinationRulesProps> {
  constructor(props: ServiceInfoDestinationRulesProps) {
    super(props);
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.props.destinationRules || []).map((destinationRule, i) => (
              <div className="card-pf-body" key={'virtualService' + i}>
                <div>
                  <strong>Name</strong>: {destinationRule.name}
                </div>
                <div>
                  <strong>Created at</strong>: <LocalTime time={destinationRule.created_at} />
                </div>
                <div>
                  <strong>Resource Version</strong>: {destinationRule.resource_version}
                </div>
                {destinationRule.trafficPolicy ? (
                  <DetailObject name="Traffic Policy" detail={destinationRule.trafficPolicy} />
                ) : (
                  undefined
                )}
                {destinationRule.subsets && destinationRule.subsets.length > 0 ? (
                  <DetailObject name="Subsets" detail={destinationRule.subsets} labels={['labels']} />
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

export default ServiceInfoDestinationRules;
