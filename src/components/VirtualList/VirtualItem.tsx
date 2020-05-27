import * as React from 'react';
import { Resource, IstioTypes, hasHealth, RenderResource } from './Config';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { Health } from '../../types/Health';
import { StatefulFilters } from '../Filters/StatefulFilters';

type VirtualItemProps = {
  item: RenderResource;
  style?: any;
  className?: string;
  index: number;
  config: Resource;
  statefulFilter?: React.RefObject<StatefulFilters>;
};

type VirtualItemState = {
  health?: Health;
};

export default class VirtualItem extends React.Component<VirtualItemProps, VirtualItemState> {
  private promises = new PromisesRegistry();

  constructor(props: VirtualItemProps) {
    super(props);
    this.state = { health: undefined };
  }

  componentDidMount() {
    if (hasHealth(this.props.item)) {
      this.onHealthPromiseChanged(this.props.item.healthPromise);
    }
  }

  componentDidUpdate(prevProps: VirtualItemProps) {
    if (hasHealth(this.props.item) && this.props.item.healthPromise !== prevProps.item['healthPromise']) {
      this.onHealthPromiseChanged(this.props.item.healthPromise);
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  onHealthPromiseChanged = async (promise: Promise<Health>): Promise<void> => {
    this.promises
      .register('health', promise)
      .then((h) => {
        this.setState({ health: h });
      })
      .catch((err) => {
        if (!err.isCanceled) {
          this.setState({ health: undefined });
          throw err;
        }
      });
  };

  renderDetails = (item: RenderResource, health?: Health) => {
    const icon = this.getIcon();
    return this.props.config.columns.map((object) =>
      object.renderer(item, this.props.config, icon, health, this.props.statefulFilter)
    );
  };

  getIcon = () => {
    if (this.props.config.name !== 'istio') {
      return this.props.config.icon;
    } else {
      return IstioTypes[this.props.item['type']].icon;
    }
  };

  render() {
    const { style, className, item } = this.props;
    return (
      <tr
        style={style}
        className={className}
        role="row"
        key={'VirtualItem_' + ('namespace' in item ? item.namespace : item.name) + '_' + item.name}
      >
        {this.renderDetails(item, this.state.health)}
      </tr>
    );
  }
}
