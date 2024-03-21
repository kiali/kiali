import * as React from 'react';
import { Tr } from '@patternfly/react-table';
import { Resource, IstioTypes, hasHealth, RenderResource } from './Config';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { Health } from '../../types/Health';
import { StatefulFilters } from '../Filters/StatefulFilters';
import { actionRenderer } from './Renderers';
import { CSSProperties } from 'react';
import { getNamespace } from '../../utils/Common';

type VirtualItemProps = {
  action?: JSX.Element;
  className?: string;
  columns: any[];
  config: Resource;
  index: number;
  item: RenderResource;
  statefulFilterProps?: React.RefObject<StatefulFilters>;
  style?: CSSProperties;
};

type VirtualItemState = {
  health?: Health;
};

export class VirtualItem extends React.Component<VirtualItemProps, VirtualItemState> {
  private promises = new PromisesRegistry();

  constructor(props: VirtualItemProps) {
    super(props);
    this.state = { health: undefined };
  }

  componentDidMount(): void {
    if (hasHealth(this.props.item)) {
      this.setState({ health: this.props.item.health });
    }
  }

  componentDidUpdate(prevProps: VirtualItemProps): void {
    if (hasHealth(this.props.item) && this.props.item.health !== prevProps.item['health']) {
      this.setState({ health: this.props.item.health });
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  renderDetails = (item: RenderResource, health?: Health): React.ReactNode => {
    return this.props.columns
      .filter(object => !!object.renderer)
      .map(object => object.renderer(item, this.props.config, this.getBadge(), health, this.props.statefulFilterProps));
  };

  getBadge = (): React.ReactNode => {
    return this.props.config.name !== 'istio' ? this.props.config.badge : IstioTypes[this.props.item['type']].badge;
  };

  render(): React.ReactNode {
    const { style, className, item } = this.props;
    const cluster = item.cluster ? `_Cluster${item.cluster}` : '';
    const namespace = 'namespace' in item ? `_Ns${getNamespace(item.namespace)}` : '';
    const type = 'type' in item ? `_${item.type}` : '';
    // End result looks like: VirtualItem_Clusterwest_Nsbookinfo_gateway_bookinfo-gateway

    const key = `VirtualItem${cluster}${namespace}${type}_${item.name}`;

    return (
      <Tr style={style} className={className} role="row" key={key} data-test={key}>
        {this.renderDetails(item, this.state.health)}
        {this.props.action && actionRenderer(key, this.props.action)}
      </Tr>
    );
  }
}
