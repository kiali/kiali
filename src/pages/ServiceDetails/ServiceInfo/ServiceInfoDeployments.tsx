import * as React from 'react';
import { Col, Row, Icon } from 'patternfly-react';
import LocalTime from '../../../components/Time/LocalTime';
import Badge from '../../../components/Badge/Badge';
import { Deployment } from '../../../types/ServiceInfo';
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
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.props.deployments || []).map((deployment, u) => (
              <div className="card-pf-body" key={'deployments_' + u}>
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
                <div>
                  <span>
                    <strong>Created at: </strong>
                    <LocalTime time={deployment.created_at} />
                  </span>
                </div>
                <div>
                  <span>
                    <strong>Resource Version: </strong>
                    {deployment.resource_version}
                  </span>
                </div>
                <hr />
              </div>
            ))}
          </Col>
        </Row>
      </div>
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
