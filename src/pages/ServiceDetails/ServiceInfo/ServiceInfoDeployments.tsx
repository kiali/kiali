import * as React from 'react';
import { Col, Row, Icon } from 'patternfly-react';
import LocalTime from '../../../components/Time/LocalTime';
import Badge from '../../../components/Badge/Badge';
import { Deployment } from '../../../types/ServiceInfo';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import { ratioCheck, Status } from '../../../components/ServiceHealth/HealthHelper';

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
                  {this.renderStatus(ratioCheck(deployment.available_replicas, deployment.replicas))}
                </div>
                {deployment.autoscaler.name !== '' && (
                  <div>
                    <strong>Autoscaler: </strong>
                    from {deployment.autoscaler.min_replicas} to {deployment.autoscaler.max_replicas} pods ({
                      deployment.autoscaler.target_cpu_utilization_percentage
                    }% CPU)
                  </div>
                )}
                <p>
                  <strong>Created at: </strong>
                  <LocalTime time={deployment.created_at} />
                </p>
              </div>
              <hr />
            </Col>
          </Row>
        ))}
      />
    );
  }

  renderStatus(status: Status) {
    if (status.icon) {
      return <Icon type="pf" name={status.icon} />;
    } else {
      return <span style={{ color: status.color }}>{status.text}</span>;
    }
  }
}

export default ServiceInfoDeployments;
