import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import {
  TargetPanelCommonProps,
  getHealthStatus,
  targetPanel,
  targetPanelBody,
  targetPanelHeading
} from './TargetPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { MeshInfraType, MeshNodeData } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { Title, TitleSizes } from '@patternfly/react-core';

type TargetPanelNodeState = {
  loading: boolean;
  node?: Node<NodeModel, any>;
};

const defaultState: TargetPanelNodeState = {
  loading: false,
  node: undefined
};

const nodeStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

export class TargetPanelNode extends React.Component<TargetPanelCommonProps, TargetPanelNodeState> {
  constructor(props: TargetPanelCommonProps) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps = (
    props: TargetPanelCommonProps,
    state: TargetPanelNodeState
  ): TargetPanelNodeState | null => {
    // if the target (i.e. node) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.node ? { node: props.target.elem as Node<NodeModel, any>, loading: true } : null;
  };

  componentDidMount(): void {}

  componentDidUpdate(_prevProps: TargetPanelCommonProps): void {}

  componentWillUnmount(): void {}

  render(): React.ReactNode {
    if (!this.state.node) {
      return null;
    }

    const node = this.props.target.elem as Node<NodeModel, any>;
    const data = node.getData() as MeshNodeData;

    return (
      <div className={classes(panelStyle, targetPanel)}>
        <div className={targetPanelHeading}>{this.renderNodeHeader(data)}</div>
        <div className={targetPanelBody}>
          {data.version && (
            <div style={{ textAlign: 'left' }}>
              {`Version: `}
              {data.version}
              <br />
            </div>
          )}
          <pre>{JSON.stringify(data.infraData, null, 2)}</pre>
        </div>
      </div>
    );
  }

  private renderNodeHeader = (data: MeshNodeData): React.ReactNode => {
    let pfBadge = PFBadges.Unknown;

    switch (data.infraType) {
      case MeshInfraType.CLUSTER:
        pfBadge = PFBadges.Cluster;
        break;
      case MeshInfraType.GRAFANA:
        pfBadge = PFBadges.Grafana;
        break;
      case MeshInfraType.KIALI:
        pfBadge = PFBadges.Kiali;
        break;
      case MeshInfraType.METRIC_STORE:
        pfBadge = PFBadges.MetricStore;
        break;
      case MeshInfraType.TRACE_STORE:
        pfBadge = PFBadges.TraceStore;
        break;
      default:
        console.warn(`MeshElems: Unexpected infraType [${data.infraType}] `);
    }

    return (
      <React.Fragment key={data.infraName}>
        <Title headingLevel="h5" size={TitleSizes.lg}>
          <span className={nodeStyle}>
            <PFBadge badge={pfBadge} size="sm" />
            {data.infraName}
          </span>
        </Title>
        <span className={nodeStyle}>
          <PFBadge badge={PFBadges.Namespace} size="sm" />
          {data.namespace}
        </span>
        <span className={nodeStyle}>
          <PFBadge badge={PFBadges.Cluster} size="sm" />
          {data.cluster}
        </span>
        {getHealthStatus(data)}
      </React.Fragment>
    );
  };
}
