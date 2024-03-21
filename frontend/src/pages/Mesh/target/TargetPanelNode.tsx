import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import {
  TargetPanelCommonProps,
  targetPanel,
  targetPanelBody,
  targetPanelHeading,
  targetPanelWidth
} from './TargetPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { MeshInfraType, MeshNodeData } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelStyle } from 'pages/Graph/SummaryPanelStyle';

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
    const data = node.getData() as MeshNodeData;

    return (
      <div className={classes(panelStyle, targetPanel)}>
        <div className={targetPanelHeading}>{this.renderNodeHeader(data)}</div>
        <div className={targetPanelBody}>
          <pre>{JSON.stringify(data.infraData, null, 2)}</pre>
        </div>
      </div>
    );
  }

  private renderNodeHeader = (data: MeshNodeData): React.ReactNode => {
    let pfBadge;

    switch (data.infraType) {
      case MeshInfraType.CLUSTER:
        pfBadge = PFBadges.Cluster;
        break;
      case MeshInfraType.GRAFANA:
        pfBadge = PFBadges.Grafana;
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
        console.warn(`MeshElems: Unexpected infraType [${data.infraType}] `);
    }

    return (
      <React.Fragment key={data.infraName}>
        <span className={nodeStyle}>
          <PFBadge badge={PFBadges.Cluster} size="sm" />
          {data.cluster}
        </span>
        <span className={nodeStyle}>
          <PFBadge badge={PFBadges.Namespace} size="sm" />
          {data.namespace}
        </span>
        <span className={nodeStyle}>
          <PFBadge badge={pfBadge} size="sm" />
          {data.infraName}
        </span>
      </React.Fragment>
    );
  };
}
