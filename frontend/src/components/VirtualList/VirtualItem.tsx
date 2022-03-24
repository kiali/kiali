import * as React from 'react';
import { Resource, IstioTypes, hasHealth, RenderResource } from './Config';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { Health } from '../../types/Health';
import { StatefulFilters } from '../Filters/StatefulFilters';
import { actionRenderer } from './Renderers';
import { CSSProperties } from 'react';

type VirtualItemProps = {
  item: RenderResource;
  style?: CSSProperties;
  className?: string;
  index: number;
  config: Resource;
  statefulFilterProps?: React.RefObject<StatefulFilters>;
  action?: JSX.Element;
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
      this.setState({ health: this.props.item.health });
    }
  }

  componentDidUpdate(prevProps: VirtualItemProps) {
    if (hasHealth(this.props.item) && this.props.item.health !== prevProps.item['health']) {
      this.setState({ health: this.props.item.health });
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  renderDetails = (item: RenderResource, health?: Health) => {
    return this.props.config.columns.map(object =>
      object.renderer(item, this.props.config, this.getBadge(), health, this.props.statefulFilterProps)
    );
  };

  getBadge = () => {
    return this.props.config.name !== 'istio' ? this.props.config.badge : IstioTypes[this.props.item['type']].badge;
  };

  render() {
    const { style, className, item } = this.props;
    const key = 'VirtualItem_' + ('namespace' in item ? 'Ns' + item.namespace + '_' + item.name : item.name);
    return (
      <tr style={style} className={className} role="row" key={key}>
        {this.renderDetails(item, this.state.health)}
        {this.props.action && actionRenderer(key, this.props.action)}
      </tr>
    );
  }
}
