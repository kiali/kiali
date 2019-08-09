import * as React from 'react';
import { TResource, Resource, IstioTypes } from './Config';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import * as Renderer from './Renderer';

type VirtualItemProps = {
  item: TResource;
  style: any;
  className: string;
  index: number;
  config: Resource;
};
type VirtualItemState = {
  health?: any;
};

export default class VirtualItem extends React.Component<VirtualItemProps, VirtualItemState> {
  private promises = new PromisesRegistry();

  constructor(props: VirtualItemProps) {
    super(props);
    this.state = { health: undefined };
  }

  componentDidMount() {
    if (this.props.item['healthPromise']) {
      this.onItemChanged(this.props.item);
    }
  }

  componentDidUpdate(prevProps: VirtualItemProps) {
    if (this.props.item['healthPromise'] && this.props.item['healthPromise'] !== prevProps.item['healthPromise']) {
      this.onItemChanged(this.props.item);
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  onItemChanged = async (item: TResource): Promise<void> => {
    this.promises
      .register('health', item['healthPromise'])
      .then(h => {
        this.setState({ health: h });
      })
      .catch(err => {
        if (!err.isCanceled) {
          this.setState({ health: undefined });
          throw err;
        }
      });
  };

  renderDetails = (item: TResource, health?: any) => {
    const icon = this.getIcon();
    return this.props.config.columns.map(object => Renderer[object.name](item, this.props.config, icon, health));
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
      <tr style={style} className={className} role="row" key={'VirtualItem_' + item.namespace + '_' + item.name}>
        {this.renderDetails(item, this.state.health)}
      </tr>
    );
  }
}
