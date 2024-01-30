import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import {
  TargetPanelCommonProps,
  getTitle,
  targetPanel,
  targetPanelHeading,
  targetPanelWidth
} from './TargetPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { MeshAttr, MeshInfraType } from 'types/Mesh';

type TargetPanelNodeState = {
  loading: boolean;
  node: any;
};

const defaultState: TargetPanelNodeState = {
  loading: false,
  node: null
};

const nodeStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

export class TargetPanelNode extends React.Component<TargetPanelCommonProps, TargetPanelNodeState> {
  static readonly panelStyle = {
    height: '100%',
    margin: 0,
    minWidth: targetPanelWidth,
    overflowY: 'auto' as 'auto',
    width: targetPanelWidth
  };

  constructor(props: TargetPanelCommonProps) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps(props: TargetPanelCommonProps, state: TargetPanelNodeState) {
    // if the target (i.e. node) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.node ? { node: props.target.elem, loading: true } : null;
  }

  componentDidMount() {}

  componentDidUpdate(_prevProps: TargetPanelCommonProps) {}

  componentWillUnmount() {}

  render() {
    const node = this.props.target.elem as Node<NodeModel, any>;
    const data = node.getData();
    const name = data[MeshAttr.infraName];
    const type = data[MeshAttr.infraType];

    return (
      <div className={targetPanel} style={TargetPanelNode.panelStyle}>
        <div className={targetPanelHeading}>{getTitle('Infra')}</div>
        {this.renderNode(name, type)}
      </div>
    );
  }

  private renderNode = (infraName: string, infraType: MeshInfraType): React.ReactNode => {
    let pfBadge;

    switch (infraType) {
      case MeshInfraType.CLUSTER:
        pfBadge = PFBadges.Cluster;
        break;
      case MeshInfraType.ISTIOD:
        pfBadge = PFBadges.Istio;
        break;
      case MeshInfraType.KIALI:
        pfBadge = PFBadges.Kiali;
        break;
      case MeshInfraType.METRIC_STORE:
        pfBadge = PFBadges.MetricStore;
        break;
      case MeshInfraType.NAMESPACE:
        pfBadge = PFBadges.Namespace;
        break;
      case MeshInfraType.TRACE_STORE:
        pfBadge = PFBadges.TraceStore;
        break;
      default:
        console.warn(`MeshElems: Unexpected infraType [${infraType}] `);
    }

    return (
      <React.Fragment key={infraName}>
        <span className={nodeStyle}>
          <PFBadge badge={pfBadge} size="sm" style={{ marginBottom: '0.125rem' }} />
          {infraName}{' '}
        </span>
        <br />
      </React.Fragment>
    );
  };
}
