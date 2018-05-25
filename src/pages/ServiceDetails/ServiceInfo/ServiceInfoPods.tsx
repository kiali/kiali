import * as React from 'react';
import { Col, Row } from 'patternfly-react';
import LocalTime from '../../../components/Time/LocalTime';
import Badge from '../../../components/Badge/Badge';
import { Pod } from '../../../types/ServiceInfo';
import { PfColors } from '../../../components/Pf/PfColors';

interface Props {
  pods?: Pod[];
}

class ServiceInfoPods extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.props.pods || []).map((pod, u) => (
              <div className="card-pf-body" key={'pods_' + u}>
                <h3>{pod.name}</h3>
                <div key="labels">
                  {Object.keys(pod.labels || {}).map((key, i) => (
                    <Badge
                      key={'pod_' + i}
                      scale={0.8}
                      style="plastic"
                      color={PfColors.Green}
                      leftText={key}
                      rightText={pod.labels ? pod.labels[key] : ''}
                    />
                  ))}
                </div>
                <div>
                  <span>
                    <strong>Created at: </strong>
                    <LocalTime time={pod.createdAt} />
                  </span>
                </div>
                {pod.createdBy && (
                  <div>
                    <span>
                      <strong>Created by: </strong>
                      {pod.createdBy.name + ' (' + pod.createdBy.kind + ')'}
                    </span>
                  </div>
                )}
                {pod.istioInitContainers && (
                  <div>
                    <span>
                      <strong>Istio init containers: </strong>
                      {pod.istioInitContainers.map(c => `${c.name} [${c.image}]`).join(', ')}
                    </span>
                  </div>
                )}
                {pod.istioContainers && (
                  <div>
                    <span>
                      <strong>Istio containers: </strong>
                      {pod.istioContainers.map(c => `${c.name} [${c.image}]`).join(', ')}
                    </span>
                  </div>
                )}
                <hr />
              </div>
            ))}
          </Col>
        </Row>
      </div>
    );
  }
}

export default ServiceInfoPods;
