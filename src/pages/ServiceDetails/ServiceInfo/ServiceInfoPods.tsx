import * as React from 'react';
import ServiceInfoBadge from './ServiceInfoBadge';
import ServiceInfoCard from './ServiceInfoCard';
import { Pod } from '../../../types/ServiceInfo';

interface ServiceInfoPodsProps {
  pods?: Pod[];
}

class ServiceInfoPods extends React.Component<ServiceInfoPodsProps> {
  constructor(props: ServiceInfoPodsProps) {
    super(props);
  }

  render() {
    return (
      <ServiceInfoCard
        iconType="fa"
        iconName="cube"
        title="Pods"
        items={(this.props.pods || []).map((pod, u) => (
          <div key={'pods_' + u}>
            <div>
              <strong>Pod</strong>: {pod['name']}
            </div>
            <ul style={{ listStyleType: 'none' }}>
              {Object.keys(pod.labels || new Map()).map((key, i) => (
                <li key={'pod_labels_badge_' + i}>
                  <ServiceInfoBadge
                    scale={0.8}
                    style="plastic"
                    color="green"
                    leftText={key}
                    rightText={pod.labels ? pod.labels[key] : ''}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      />
    );
  }
}

export default ServiceInfoPods;
