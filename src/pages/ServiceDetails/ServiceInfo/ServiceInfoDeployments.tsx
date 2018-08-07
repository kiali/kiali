import * as React from 'react';
import { Col, Row, Icon } from 'patternfly-react';
import LocalTime from '../../../components/Time/LocalTime';
import { Deployment } from '../../../types/ServiceInfo';
import { ratioCheck, Status } from '../../../types/Health';
import Label from '../../../components/Label/Label';

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
                <h3>{deployment.name}</h3>
                <div key="labels" className="label-collection">
                  {Object.keys(deployment.labels || {}).map((key, i) => (
                    <Label key={'deployment_' + i} name={key} value={deployment.labels ? deployment.labels[key] : ''} />
                  ))}
                </div>
                <div>
                  <strong>Pod status: </strong> {deployment.availableReplicas} / {deployment.replicas}{' '}
                  {this.renderStatus(ratioCheck(deployment.availableReplicas, deployment.replicas))}
                </div>
                {deployment.autoscaler.name !== '' && (
                  <div>
                    <strong>Autoscaler: </strong>
                    from {deployment.autoscaler.minReplicas} to {deployment.autoscaler.maxReplicas} pods ({
                      deployment.autoscaler.targetCPUUtilizationPercentage
                    }% CPU)
                  </div>
                )}
                <div>
                  <span>
                    <strong>Created at: </strong>
                    <LocalTime time={deployment.createdAt} />
                  </span>
                </div>
                <div>
                  <span>
                    <strong>Resource Version: </strong>
                    {deployment.resourceVersion}
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
