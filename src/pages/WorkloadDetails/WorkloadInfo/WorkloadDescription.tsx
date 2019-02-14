import * as React from 'react';
import { Row, Col } from 'patternfly-react';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import { Workload, WorkloadIcon } from '../../../types/Workload';
import Label from '../../../components/Label/Label';
import LocalTime from '../../../components/Time/LocalTime';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import { WorkloadHealth } from '../../../types/Health';
import { runtimes } from '../../../config/Logos';

type WorkloadDescriptionProps = {
  workload: Workload;
  istioEnabled: boolean;
  health?: WorkloadHealth;
};

type WorkloadDescriptionState = {};

class WorkloadDescription extends React.Component<WorkloadDescriptionProps, WorkloadDescriptionState> {
  constructor(props: WorkloadDescriptionProps) {
    super(props);
    this.state = {};
  }

  renderLogo(name: string, idx: number): JSX.Element {
    const imageName = runtimes[name];
    if (imageName) {
      const logo = require('../../../assets/img/' + imageName);
      return <img key={'logo-' + idx} src={logo} alt={name} />;
    }
    return <>{name}</>;
  }

  render() {
    const workload = this.props.workload;
    const isTemplateLabels =
      workload &&
      ['Deployment', 'ReplicaSet', 'ReplicationController', 'DeploymentConfig', 'StatefulSet'].indexOf(workload.type) >=
        0;
    return workload ? (
      <PfInfoCard
        iconType="pf"
        iconName={WorkloadIcon}
        title={workload.name}
        istio={this.props.istioEnabled}
        items={
          <Row>
            <Col xs={12} sm={8} md={6} lg={6}>
              <div className="progress-description">
                <strong>{isTemplateLabels ? 'Template Labels' : 'Labels'}</strong>
              </div>
              <div className="label-collection">
                {Object.keys(workload.labels || {}).map((key, i) => (
                  <div key={'label_' + i}>
                    <Label name={key} value={workload.labels ? workload.labels[key] : ''} />
                  </div>
                ))}
              </div>
              <div>
                <strong>Type</strong> {workload.type ? workload.type : ''}
              </div>
              <div>
                <strong>Created at</strong> <LocalTime time={workload.createdAt} />
              </div>
              <div>
                <strong>Resource Version</strong> {workload.resourceVersion}
              </div>
              {workload.runtimes.length > 0 && (
                <div>
                  <br />
                  {workload.runtimes
                    .map((rt, idx) => this.renderLogo(rt.name, idx))
                    .reduce((list: JSX.Element[], elem) => (list ? [...list, <> | </>, elem] : [elem]), undefined)}
                </div>
              )}
            </Col>
            <Col xs={12} sm={4} md={3} lg={3} />
            <Col xs={12} sm={4} md={3} lg={3}>
              <div className="progress-description">
                <strong>Health</strong>
              </div>
              <HealthIndicator
                id={workload.name}
                health={this.props.health}
                mode={DisplayMode.LARGE}
                tooltipPlacement="left"
              />
            </Col>
          </Row>
        }
      />
    ) : (
      'Loading'
    );
  }
}

export default WorkloadDescription;
