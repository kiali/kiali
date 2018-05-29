import * as React from 'react';
import { Col, Icon, Row } from 'patternfly-react';
import {
  EditorLink,
  globalChecks,
  ObjectValidation,
  RouteRule,
  validationToIconName
} from '../../../types/ServiceInfo';
import LocalTime from '../../../components/Time/LocalTime';
import RouteRuleRoute from './ServiceInfoRouteRules/RouteRuleRoute';
import DetailObject from '../../../components/Details/DetailObject';
import { Link } from 'react-router-dom';

interface ServiceInfoRouteRulesProps extends EditorLink {
  routeRules?: RouteRule[];
  validations: { [key: string]: ObjectValidation };
}

class ServiceInfoRouteRules extends React.Component<ServiceInfoRouteRulesProps> {
  constructor(props: ServiceInfoRouteRulesProps) {
    super(props);
  }

  rawConfig(rule: RouteRule, i: number) {
    return (
      <div className="card-pf-body" key={'ruleconfig' + i}>
        <h3>
          <Link to={this.props.editorLink + '?routerule=' + rule.name}>{rule.name}</Link>
        </h3>
        {this.globalStatus(rule)}
        <div>
          <strong>Created at</strong>: <LocalTime time={rule.createdAt} />
        </div>
        <div>
          <strong>Resource Version</strong>: {rule.resourceVersion}
        </div>
        <div>
          <strong>Precedence</strong>: {rule.precedence}
        </div>
        {rule.match ? <DetailObject name="Match" detail={rule.match} /> : null}
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
      </div>
    );
  }

  weights(rule: RouteRule) {
    return rule.route ? (
      <RouteRuleRoute name={rule.name} route={rule.route} validations={this.props.validations} />
    ) : null;
  }

  validation(rule: RouteRule): ObjectValidation {
    return this.props.validations[rule.name];
  }

  globalStatus(rule: RouteRule) {
    let validation = this.validation(rule);
    let checks = globalChecks(this.validation(rule));
    let iconName = validationToIconName(this.validation(rule));
    let message = checks.map(check => check.message).join(',');

    if (!message.length) {
      if (validation && !validation.valid) {
        message = 'Not all checks passed!';
      }
    }

    if (message.length) {
      return (
        <div>
          <p style={{ color: 'red' }}>
            <Icon type="pf" name={iconName} /> {message}
          </p>
        </div>
      );
    } else {
      return '';
    }
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.props.routeRules || []).map((rule, i) => (
              <Row key={'routerule' + i} className="row-cards-pf">
                <Col xs={12} sm={12} md={3} lg={3}>
                  {this.rawConfig(rule, i)}
                </Col>
                <Col xs={12} sm={12} md={5} lg={5}>
                  {this.weights(rule)}
                </Col>
              </Row>
            ))}
          </Col>
        </Row>
      </div>
    );
  }
}

export default ServiceInfoRouteRules;
