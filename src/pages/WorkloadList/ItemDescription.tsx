import * as React from 'react';
import { Badge, ListViewItem, ListViewIcon } from 'patternfly-react';
import { IstioLogo } from '../../logos';
import { WorkloadIcon, WorkloadListItem, worloadLink } from '../../types/Workload';
import { PfColors } from '../../components/Pf/PfColors';
import { Link } from 'react-router-dom';
import { WorkloadHealth } from '../../types/Health';
import { DisplayMode, HealthIndicator } from '../../components/Health/HealthIndicator';
import ErrorRate from './ErrorRate';
import { CancelablePromise, makeCancelablePromise } from '../../utils/Common';

type ItemDescriptionState = {
  health?: WorkloadHealth;
};

type ItemDescriptionProps = {
  workloadItem: WorkloadListItem;
  position: Number;
};

class ItemDescription extends React.Component<ItemDescriptionProps, ItemDescriptionState> {
  private healthPromise?: CancelablePromise<WorkloadHealth>;

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
    if (this.healthPromise) {
      this.healthPromise.cancel();
      this.healthPromise = undefined;
    }
  }

  onItemChanged(item: WorkloadListItem) {
    if (this.healthPromise) {
      this.healthPromise.cancel();
    }

    this.healthPromise = makeCancelablePromise(item.healthPromise);
    this.healthPromise.promise.then(h => this.setState({ health: h })).catch(err => {
      if (!err.isCanceled) {
        this.setState({ health: undefined });
      }
    });
  }

  render() {
    let namespace = this.props.workloadItem.namespace;
    let object = this.props.workloadItem.workload;
    let iconName = WorkloadIcon;
    let iconType = 'pf';
    const heading = (
      <div className="ServiceList-Heading">
        <div className="ServiceList-IstioLogo">
          {object.istioSidecar && <img className="IstioLogo" src={IstioLogo} alt="Istio sidecar" />}
        </div>
        <div className="ServiceList-Title">
          {object.name}
          <small>{namespace}</small>
          <small>{object.type}</small>
        </div>
      </div>
    );
    const itemDescription = (
      <table style={{ width: '50em', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            {this.state.health && (
              <td>
                <strong>Health: </strong>
                <HealthIndicator id={object.name} health={this.state.health} mode={DisplayMode.SMALL} />
              </td>
            )}
            {this.state.health && (
              <td>
                <ErrorRate requestHealth={this.state.health.requests} />
              </td>
            )}
            {object.appLabel || object.versionLabel ? (
              <td>
                <strong>Label Validation :</strong>
                {object.appLabel && <Badge>app</Badge>}
                {object.versionLabel && <Badge>version</Badge>}
              </td>
            ) : (
              <td />
            )}
          </tr>
        </tbody>
      </table>
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
