import * as React from 'react';
import { DestinationPolicy } from '../../../types/ServiceInfo';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import RouteRuleIstioService from './ServiceInfoRouteRules/RouteRuleIstioService';

interface ServiceInfoDestinationPoliciesProps {
  destinationPolicies?: DestinationPolicy[];
}

class ServiceInfoDestinationPolicies extends React.Component<ServiceInfoDestinationPoliciesProps> {
  constructor(props: ServiceInfoDestinationPoliciesProps) {
    super(props);
  }

  render() {
    return (
      <PfInfoCard
        iconType="pf"
        iconName="settings"
        title="Istio Destination Policies"
        items={(this.props.destinationPolicies || []).map((dPolicy, i) => {
          let loadBalancing;
          if (dPolicy.loadbalancing) {
            loadBalancing = (
              <div>
                <strong>LoadBalancing</strong>
                {': '}
                {dPolicy.loadbalancing.name}
              </div>
            );
          }
          let circuitBreaker;
          if (dPolicy.circuitBreaker) {
            circuitBreaker = (
              <div>
                <strong>CircuitBreaker</strong>
                <ul style={{ listStyleType: 'none' }}>
                  {dPolicy.circuitBreaker.simpleCb ? (
                    <li>
                      <strong>simpleCb</strong>
                      <ul style={{ listStyleType: 'none' }}>
                        {dPolicy.circuitBreaker.simpleCb.maxConnections ? (
                          <li>[maxConnections] {dPolicy.circuitBreaker.simpleCb.maxConnections}</li>
                        ) : null}
                        {dPolicy.circuitBreaker.simpleCb.httpMaxPendingRequests ? (
                          <li>[httpMaxPendingRequests] {dPolicy.circuitBreaker.simpleCb.httpMaxPendingRequests}</li>
                        ) : null}
                        {dPolicy.circuitBreaker.simpleCb.httpMaxRequests ? (
                          <li>[httpMaxRequests] {dPolicy.circuitBreaker.simpleCb.httpMaxRequests}</li>
                        ) : null}
                        {dPolicy.circuitBreaker.simpleCb.sleepWindow ? (
                          <li>[sleepWindow] {dPolicy.circuitBreaker.simpleCb.sleepWindow}</li>
                        ) : null}
                        {dPolicy.circuitBreaker.simpleCb.httpConsecutiveErrors ? (
                          <li>[httpConsecutiveErrors] {dPolicy.circuitBreaker.simpleCb.httpConsecutiveErrors}</li>
                        ) : null}
                        {dPolicy.circuitBreaker.simpleCb.httpDetectionInterval ? (
                          <li>[httpDetectionInterval] {dPolicy.circuitBreaker.simpleCb.httpDetectionInterval}</li>
                        ) : null}
                        {dPolicy.circuitBreaker.simpleCb.httpMaxRequestsPerConnection ? (
                          <li>
                            [httpMaxRequestsPerConnection]{' '}
                            {dPolicy.circuitBreaker.simpleCb.httpMaxRequestsPerConnection}
                          </li>
                        ) : null}
                        {dPolicy.circuitBreaker.simpleCb.httpMaxEjectionPercent ? (
                          <li>[httpMaxEjectionPercent] {dPolicy.circuitBreaker.simpleCb.httpMaxEjectionPercent}</li>
                        ) : null}
                        {dPolicy.circuitBreaker.simpleCb.httpMaxRetries ? (
                          <li>[httpMaxRetries] {dPolicy.circuitBreaker.simpleCb.httpMaxRetries}</li>
                        ) : null}
                      </ul>
                    </li>
                  ) : null}
                  {dPolicy.circuitBreaker.custom ? <li>[custom] {dPolicy.circuitBreaker.custom}</li> : null}
                </ul>
              </div>
            );
          }
          return (
            <div key={'rule' + i}>
              <div>
                <strong>Name</strong>
                {': '}
                {dPolicy.name}
              </div>
              {dPolicy.destination ? <RouteRuleIstioService name="Destination" service={dPolicy.destination} /> : null}
              {dPolicy.source ? <RouteRuleIstioService name="Source" service={dPolicy.source} /> : null}

              {loadBalancing}
              {circuitBreaker}
              <hr />
            </div>
          );
        })}
      />
    );
  }
}

export default ServiceInfoDestinationPolicies;
