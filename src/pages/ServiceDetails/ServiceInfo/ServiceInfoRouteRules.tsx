import * as React from 'react';
import { RouteRule } from '../../../types/ServiceInfo';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import RouteRuleMatch from './ServiceInfoRouteRules/RouteRuleMatch';
import RouteRuleRoute from './ServiceInfoRouteRules/RouteRuleRoute';
import RouteRuleRedirect from './ServiceInfoRouteRules/RouteRuleRedirect';
import RouteRuleHTTPTimeout from './ServiceInfoRouteRules/RouteRuleHTTPTimeout';
import RouteRuleHTTPRetry from './ServiceInfoRouteRules/RouteRuleHTTPRetry';
import RouteRuleHTTPFaultInjection from './ServiceInfoRouteRules/RouteRuleHTTPFaultInjection';
import RouteRuleL4FaultInjection from './ServiceInfoRouteRules/RouteRuleL4FaultInjection';
import RouteRuleIstioService from './ServiceInfoRouteRules/RouteRuleIstioService';
import RouteRuleCorsPolicy from './ServiceInfoRouteRules/RouteRuleCorsPolicy';

interface ServiceInfoRouteRulesProps {
  routeRules?: RouteRule[];
}

class ServiceInfoRouteRules extends React.Component<ServiceInfoRouteRulesProps> {
  constructor(props: ServiceInfoRouteRulesProps) {
    super(props);
  }

  render() {
    return (
      <PfInfoCard
        iconType="pf"
        iconName="settings"
        title="Istio Route Rules"
        items={(this.props.routeRules || []).map((rule, i) => (
          <div key={'rule' + i}>
            <div>
              <strong>Name</strong>: {rule.name}
            </div>
            <div>
              <strong>Precedence</strong>: {rule.precedence}
            </div>
            {rule.match ? <RouteRuleMatch match={rule.match} /> : null}
            {rule.route ? <RouteRuleRoute route={rule.route} /> : null}
            {rule.redirect ? <RouteRuleRedirect redirect={rule.redirect} /> : null}
            {rule.websocketUpgrade ? (
              <div>
                <strong>WebSocket</strong>: {rule.websocketUpgrade}
              </div>
            ) : null}
            {rule.httpReqTimeout ? <RouteRuleHTTPTimeout timeout={rule.httpReqTimeout} /> : null}
            {rule.httpReqRetries ? <RouteRuleHTTPRetry httpReqRetries={rule.httpReqRetries} /> : null}
            {rule.httpFault ? <RouteRuleHTTPFaultInjection httpFault={rule.httpFault} /> : null}
            {rule.l4Fault ? <RouteRuleL4FaultInjection l4Fault={rule.l4Fault} /> : null}
            {rule.mirror ? <RouteRuleIstioService name="Mirror" service={rule.mirror} /> : null}
            {rule.corsPolicy ? <RouteRuleCorsPolicy corsPolicy={rule.corsPolicy} /> : null}
            <hr />
          </div>
        ))}
      />
    );
  }
}

export default ServiceInfoRouteRules;
