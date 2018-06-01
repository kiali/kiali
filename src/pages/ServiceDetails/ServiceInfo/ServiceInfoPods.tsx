import * as React from 'react';
import { Col, Row, OverlayTrigger, Tooltip } from 'patternfly-react';
import Badge from '../../../components/Badge/Badge';
import { Pod } from '../../../types/ServiceInfo';
import { PfColors } from '../../../components/Pf/PfColors';
import { PodsGroup, groupPods } from './ServiceInfoPodsGrouping';

interface Props {
  pods?: Pod[];
}

class ServiceInfoPods extends React.Component<Props> {
  groups: PodsGroup[];

  constructor(props: Props) {
    super(props);
    if (props.pods) {
      this.groups = groupPods(props.pods);
    } else {
      this.groups = [];
    }
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.groups || []).map((group, u) => (
              <div className="card-pf-body" key={'pods_' + u}>
                <h3>
                  {group.numberOfPods > 1 ? (
                    <OverlayTrigger
                      // Prettier makes irrelevant line-breaking clashing with tslint
                      // prettier-ignore
                      overlay={<Tooltip id={'pod_names_' + u} title="Pod Names">{group.names.join(', ')}</Tooltip>}
                      placement="top"
                      trigger={['hover', 'focus']}
                    >
                      <span>{group.commonPrefix + '... (' + group.numberOfPods + ' replicas)'}</span>
                    </OverlayTrigger>
                  ) : (
                    group.commonPrefix + ' (1 replica)'
                  )}
                </h3>
                <div key="labels">
                  {Object.keys(group.commonLabels).map((key, i) => (
                    <Badge
                      key={'pod_' + u + '_' + i}
                      scale={0.8}
                      style="plastic"
                      color={PfColors.Green}
                      leftText={key}
                      rightText={group.commonLabels[key]}
                    />
                  ))}
                </div>
                <div>
                  <span>
                    {group.createdAtStart === group.createdAtEnd ? (
                      <>
                        <strong>Created at: </strong>
                        {new Date(group.createdAtStart).toLocaleString()}
                      </>
                    ) : (
                      <>
                        <strong>Created between: </strong>
                        {new Date(group.createdAtStart).toLocaleString() +
                          ' and ' +
                          new Date(group.createdAtEnd).toLocaleString()}
                      </>
                    )}
                  </span>
                </div>
                {group.createdBy && (
                  <div>
                    <span>
                      <strong>Created by: </strong>
                      {group.createdBy.name + ' (' + group.createdBy.kind + ')'}
                    </span>
                  </div>
                )}
                {group.istioInitContainers && (
                  <div>
                    <span>
                      <strong>Istio init containers: </strong>
                      {group.istioInitContainers.map(c => `${c.name} [${c.image}]`).join(', ')}
                    </span>
                  </div>
                )}
                {group.istioContainers && (
                  <div>
                    <span>
                      <strong>Istio containers: </strong>
                      {group.istioContainers.map(c => `${c.name} [${c.image}]`).join(', ')}
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
