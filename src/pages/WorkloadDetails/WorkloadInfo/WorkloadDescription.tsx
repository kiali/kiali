import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import { Workload } from '../../../types/Workload';
import LocalTime from '../../../components/Time/LocalTime';
import { DisplayMode, HealthIndicator } from '../../../components/Health/HealthIndicator';
import { WorkloadHealth } from '../../../types/Health';
import { runtimesLogoProviders } from '../../../config/Logos';
import Labels from '../../../components/Label/Labels';

type WorkloadDescriptionProps = {
  workload: Workload;
  namespace: string;
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
    const logoProvider = runtimesLogoProviders[name];
    if (logoProvider) {
      return <img key={'logo-' + idx} src={logoProvider()} alt={name} title={name} />;
    }
    return <span key={'runtime-' + idx}>{name}</span>;
  }

  render() {
    const workload = this.props.workload;
    const isTemplateLabels =
      workload &&
      ['Deployment', 'ReplicaSet', 'ReplicationController', 'DeploymentConfig', 'StatefulSet'].indexOf(workload.type) >=
        0;
    return workload ? (
      <div className="card-pf">
        <div className="card-pf-body">
          <Row>
            <Col xs={12} sm={8} md={6} lg={6}>
              <div id="labels">
                <div className="progress-description">
                  <strong>{isTemplateLabels ? 'Template Labels' : 'Labels'}</strong>
                </div>
                <div className="label-collection">
                  <Labels labels={workload.labels} />
                </div>
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
                    .filter(r => r.name !== '')
                    .map((rt, idx) => this.renderLogo(rt.name, idx))
                    .reduce(
                      (list: JSX.Element[], elem) =>
                        list.length > 0 ? [...list, <span key="sep"> | </span>, elem] : [elem],
                      []
                    )}
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
        </div>
      </div>
    ) : (
      'Loading'
    );
  }
}

export default WorkloadDescription;
