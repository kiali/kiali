import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import { RouteRule } from '../../../types/ServiceInfo';
import LocalTime from '../../../components/Time/LocalTime';
import RouteRuleRoute from './ServiceInfoRouteRules/RouteRuleRoute';
import DetailObject from '../../../components/Details/DetailObject';

interface ServiceInfoRouteRulesProps {
  routeRules?: RouteRule[];
}

class ServiceInfoRouteRules extends React.Component<ServiceInfoRouteRulesProps> {
  constructor(props: ServiceInfoRouteRulesProps) {
    super(props);
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.props.routeRules || []).map((rule, i) => (
              <div className="card-pf-body" key={'rule' + i}>
                <div>
                  <strong>Name</strong>: {rule.name}
                </div>
                <div>
                  <strong>Created at</strong>: <LocalTime time={rule.created_at} />
                </div>
                <div>
                  <strong>Resource Version</strong>: {rule.resource_version}
                </div>
                <div>
                  <strong>Precedence</strong>: {rule.precedence}
                </div>
                {rule.match ? <DetailObject name="Match" detail={rule.match} /> : null}
                {rule.route ? <RouteRuleRoute route={rule.route} /> : null}
                {rule.redirect ? <DetailObject name="Redirect" detail={rule.redirect} /> : null}
                {rule.websocketUpgrade ? (
                  <div>
                    <strong>WebSocket</strong>: {rule.websocketUpgrade}
                  </div>
                ) : null}
                {rule.httpReqTimeout ? <DetailObject name="Http Timeout" detail={rule.httpReqTimeout} /> : null}
                {rule.httpReqRetries ? <DetailObject name="Http Retry" detail={rule.httpReqRetries} /> : null}
                {rule.httpFault ? <DetailObject name="Http Fault" detail={rule.httpFault} /> : null}
                {rule.l4Fault ? <DetailObject name="L4 Fault" detail={rule.l4Fault} /> : null}
                {rule.mirror ? <DetailObject name="Mirror" detail={rule.mirror} /> : null}
                {rule.corsPolicy ? <DetailObject name="Cors Policy" detail={rule.corsPolicy} /> : null}
                <hr />
              </div>
            ))}
          </Col>
        </Row>
      </div>
    );
  }
}

export default ServiceInfoRouteRules;
