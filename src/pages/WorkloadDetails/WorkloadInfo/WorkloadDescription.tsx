import * as React from 'react';
import { Deployment } from '../../../types/IstioObjects';
import { Row, Col } from 'patternfly-react';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import { WorkloadIcons } from '../../../types/Workload';
import Label from '../../../components/Label/Label';
import LocalTime from '../../../components/Time/LocalTime';

type WorkloadDescriptionProps = {
  workload: Deployment;
  istioEnabled: boolean;
};

type WorkloadDescriptionState = {};

class WorkloadDescription extends React.Component<WorkloadDescriptionProps, WorkloadDescriptionState> {
  constructor(props: WorkloadDescriptionProps) {
    super(props);
    this.state = {};
  }

  render() {
    const workload = this.props.workload;
    return workload ? (
      <PfInfoCard
        iconType="pf"
        iconName={WorkloadIcons[workload.type] || ''}
        title={workload.name}
        istio={this.props.istioEnabled}
        items={
          <Row>
            <Col xs={12} sm={6} md={2} lg={2}>
              <div className="progress-description">
                <strong>Labels</strong>
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
