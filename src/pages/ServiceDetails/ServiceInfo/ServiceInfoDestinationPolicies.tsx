import * as React from 'react';
import { DestinationPolicy } from '../../../types/ServiceInfo';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import ServiceInfoBadge from './ServiceInfoBadge';

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
          let dPolicySource;
          if (dPolicy.source) {
            dPolicySource = (
              <div>
                <strong>Source</strong>
                {': '}
                {dPolicy.source.name}
              </div>
            );
          }
          let destinationLabels;
          if (dPolicy.destination && dPolicy.destination.labels) {
            let labels = Object.keys(dPolicy.destination.labels).map((key, n) => (
              <li key={'_label_' + key + '_n_' + n}>
                <ServiceInfoBadge
                  scale={0.8}
                  style="plastic"
                  color="green"
                  leftText={key}
                  rightText={dPolicy.destination.labels ? dPolicy.destination.labels[key] : ''}
                />
              </li>
            ));
            destinationLabels = (
              <div>
                <strong>Destination</strong>:
                <ul style={{ listStyleType: 'none' }}>{labels}</ul>
              </div>
            );
          }
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
                {': simpleCb'}
                <ul style={{ listStyleType: 'none' }}>
                  {!dPolicy.circuitBreaker.simpleCb.maxConnections ? null : (
                    <li>maxConnections: {dPolicy.circuitBreaker.simpleCb.maxConnections}</li>
                  )}
                  {!dPolicy.circuitBreaker.simpleCb.httpMaxPendingRequests ? null : (
                    <li>httpMaxPendingRequests: {dPolicy.circuitBreaker.simpleCb.httpMaxPendingRequests}</li>
                  )}
                  {!dPolicy.circuitBreaker.simpleCb.httpMaxRequests ? null : (
                    <li>httpMaxRequests: {dPolicy.circuitBreaker.simpleCb.httpMaxRequests}</li>
                  )}
                  {!dPolicy.circuitBreaker.simpleCb.sleepWindow ? null : (
                    <li>sleepWindow: {dPolicy.circuitBreaker.simpleCb.sleepWindow}</li>
                  )}
                  {!dPolicy.circuitBreaker.simpleCb.httpConsecutiveErrors ? null : (
                    <li>httpConsecutiveErrors: {dPolicy.circuitBreaker.simpleCb.httpConsecutiveErrors}</li>
                  )}
                  {!dPolicy.circuitBreaker.simpleCb.httpDetectionInterval ? null : (
                    <li>httpDetectionInterval: {dPolicy.circuitBreaker.simpleCb.httpDetectionInterval}</li>
                  )}
                  {!dPolicy.circuitBreaker.simpleCb.httpMaxRequestsPerConnection ? null : (
                    <li>
                      httpMaxRequestsPerConnection: {dPolicy.circuitBreaker.simpleCb.httpMaxRequestsPerConnection}
                    </li>
                  )}
                  {!dPolicy.circuitBreaker.simpleCb.httpMaxEjectionPercent ? null : (
                    <li>httpMaxEjectionPercent: {dPolicy.circuitBreaker.simpleCb.httpMaxEjectionPercent}</li>
                  )}
                  {!dPolicy.circuitBreaker.simpleCb.httpMaxRetries ? null : (
                    <li>httpMaxRetries: {dPolicy.circuitBreaker.simpleCb.httpMaxRetries}</li>
                  )}
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
              {dPolicySource}
              {destinationLabels}
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
