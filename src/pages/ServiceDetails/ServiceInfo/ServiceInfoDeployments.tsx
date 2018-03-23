import * as React from 'react';
import Badge from '../../../components/Badge/Badge';
import { Deployment } from '../../../types/ServiceInfo';
import { Col, Row, Icon } from 'patternfly-react';
import PfInfoCard from '../../../components/Pf/PfInfoCard';

interface ServiceInfoDeploymentsProps {
  deployments?: Deployment[];
}

class ServiceInfoDeployments extends React.Component<ServiceInfoDeploymentsProps> {
  constructor(props: ServiceInfoDeploymentsProps) {
    super(props);
  }

  render() {
    return (
      <PfInfoCard
        iconType="fa"
        iconName="cube"
        title="Deployments"
        items={(this.props.deployments || []).map((deployment, u) => (
          <Row key={'deployments_' + u}>
            <Col xs={12}>
              <div>
                <p>
                  <strong>{deployment.name}</strong>
                </p>
                <div key="labels">
                  {Object.keys(deployment.labels || new Map()).map((key, i) => (
                    <Badge
                      key={'deployment_' + i}
                      scale={0.8}
                      style="plastic"
                      color="green"
                      leftText={key}
                      rightText={deployment.labels ? deployment.labels[key] : ''}
                    />
                  ))}
                </div>
                <div>
                  <strong>Pod status: </strong> {deployment.available_replicas} / {deployment.replicas}{' '}
                  <Icon
                    type="pf"
                    name={deployment.available_replicas < deployment.replicas ? 'warning-triangle-o' : 'ok'}
                  />
                </div>
                {deployment.autoscaler.name !== '' && (
                  <div>
                    <strong>Autoscaler: </strong>
                    from {deployment.autoscaler.min_replicas} to {deployment.autoscaler.max_replicas} pods ({
                      deployment.autoscaler.target_cpu_utilization_percentage
                    }% CPU)
                  </div>
                )}
              </div>
              <hr />
            </Col>
          </Row>
        ))}
      />
    );
  }
}

export default ServiceInfoDeployments;
