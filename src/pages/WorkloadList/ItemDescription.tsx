import * as React from 'react';
import { Badge, Col, ListViewItem, ListViewIcon, Row } from 'patternfly-react';
import { WorkloadIcon, WorkloadListItem, worloadLink } from '../../types/Workload';
import { PfColors } from '../../components/Pf/PfColors';
import { Link } from 'react-router-dom';
import { WorkloadHealth } from '../../types/Health';
import { DisplayMode, HealthIndicator } from '../../components/Health/HealthIndicator';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import MissingSidecar from '../../components/MissingSidecar/MissingSidecar';

type ItemDescriptionState = {
  health?: WorkloadHealth;
};

type ItemDescriptionProps = {
  workloadItem: WorkloadListItem;
  position: Number;
};

class ItemDescription extends React.Component<ItemDescriptionProps, ItemDescriptionState> {
  private promises = new PromisesRegistry();

  constructor(props: ItemDescriptionProps) {
    super(props);
    this.state = {
      health: undefined
    };
  }

  componentDidMount() {
    this.onItemChanged(this.props.workloadItem);
  }

  componentDidUpdate(prevProps: ItemDescriptionProps) {
    if (this.props.workloadItem !== prevProps.workloadItem) {
      this.onItemChanged(this.props.workloadItem);
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  onItemChanged(item: WorkloadListItem) {
    this.promises
      .register('health', item.healthPromise)
      .then(h => this.setState({ health: h }))
      .catch(err => {
        if (!err.isCanceled) {
          this.setState({ health: undefined });
          throw err;
        }
      });
  }

  render() {
    const namespace = this.props.workloadItem.namespace;
    const object = this.props.workloadItem.workload;
    const iconName = WorkloadIcon;
    const iconType = 'pf';
    const heading = (
      <div className="ServiceList-Heading">
        <div className="ServiceList-Title">
          {object.name}
          <small>{namespace}</small>
          <small>{object.type}</small>
        </div>
      </div>
    );
    const itemDescription = (
      <Row>
        <Col xs={12} sm={12} md={4} lg={4}>
          {this.state.health && (
            <>
              <strong>Health: </strong>
              <HealthIndicator id={object.name} health={this.state.health} mode={DisplayMode.SMALL} />
            </>
          )}
        </Col>
        <Col xs={12} sm={12} md={4} lg={4}>
          {!object.istioSidecar && <MissingSidecar />}
        </Col>
        <Col xs={12} sm={12} md={4} lg={4}>
          {object.appLabel || object.versionLabel ? (
            <span>
              <strong>Label Validation :</strong>
              {object.appLabel && <Badge>app</Badge>}
              {object.versionLabel && <Badge>version</Badge>}
            </span>
          ) : (
            <span />
          )}
        </Col>
      </Row>
    );
    const content = (
      <ListViewItem
        leftContent={<ListViewIcon type={iconType} name={iconName} />}
        key={'worloadItemItemView_' + this.props.position + '_' + namespace + '_' + object.name}
        heading={heading}
        description={itemDescription}
      />
    );
    return (
      <Link
        key={'worloadItemItem_' + this.props.position + '_' + namespace + '_' + object.name}
        to={worloadLink(namespace, object.name)}
        style={{ color: PfColors.Black }}
      >
        {content}
      </Link>
    );
  }
}

export default ItemDescription;
