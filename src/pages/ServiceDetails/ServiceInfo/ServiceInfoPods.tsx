import * as React from 'react';
import { Col, Row, OverlayTrigger, Tooltip } from 'patternfly-react';
import { Pod } from '../../../types/IstioObjects';
import { PodsGroup, groupPods } from './ServiceInfoPodsGrouping';
import Label from '../../../components/Label/Label';

interface Props {
  pods?: Pod[];
}

interface ServiceInfoPodsState {
  groups: PodsGroup[];
}
class ServiceInfoPods extends React.Component<Props, ServiceInfoPodsState> {
  static getDerivedStateFromProps(props: Props, _currentState: ServiceInfoPodsState) {
    return { groups: ServiceInfoPods.updateGroups(props) };
  }

  static updateGroups(props: Props) {
    if (props.pods) {
      return groupPods(props.pods);
    } else {
      return [];
    }
  }

  constructor(props: Props) {
    super(props);
    this.state = { groups: ServiceInfoPods.updateGroups(props) };
  }

  render() {
    return (
      <div className="card-pf">
        <Row className="row-cards-pf">
          <Col xs={12} sm={12} md={12} lg={12}>
            {(this.state.groups || []).map((group, u) => (
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
                <div key="labels" className="label-collection">
                  {Object.keys(group.commonLabels).map((key, i) => (
                    <Label key={'pod_' + u + '_' + i} name={key} value={group.commonLabels[key]} />
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
                {group.createdBy.length > 0 && (
                  <div>
                    <span>
                      <strong>Created by: </strong>
                      {group.createdBy.map(ref => ref.name + ' (' + ref.kind + ')').join(', ')}
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
