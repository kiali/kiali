import * as React from 'react';
import { Node, NodeModel } from '@patternfly/react-topology';
import { kialiStyle } from 'styles/StyleUtils';
import { TargetPanelCommonProps, getHealthStatus, targetPanelStyle } from './TargetPanelCommon';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { MeshInfraType, MeshNodeData, isExternal } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { Title, TitleSizes } from '@patternfly/react-core';
import { t } from 'utils/I18nUtils';

type TargetPanelNodeProps = TargetPanelCommonProps;

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

export function renderNodeHeader(data: MeshNodeData, nameOnly?: boolean, nameSize?: TitleSizes): React.ReactNode {
  let pfBadge;

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
    case MeshInfraType.ISTIOD:
      pfBadge = PFBadges.Istio;
      break;
    default:
      console.warn(`MeshElems: Unexpected infraType [${data.infraType}] `);
      pfBadge = PFBadges.Unknown;
  }

  return (
    <React.Fragment key={data.infraName}>
      <Title headingLevel="h5" size={nameSize ?? TitleSizes.lg}>
        <span className={nodeStyle}>
          <PFBadge badge={pfBadge} size="global" />
          {data.infraName}
          {getHealthStatus(data)}
        </span>
      </Title>
      {!nameOnly && (
        <>
          <span className={nodeStyle}>
            <PFBadge badge={PFBadges.Namespace} size="sm" />
            {data.namespace}
          </span>
          <span className={nodeStyle}>
            <PFBadge badge={PFBadges.Cluster} size="sm" />
            {data.cluster}
          </span>
        </>
      )}
    </React.Fragment>
  );
}

export class TargetPanelNode extends React.Component<TargetPanelNodeProps, TargetPanelNodeState> {
  constructor(props: TargetPanelNodeProps) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps: React.GetDerivedStateFromProps<TargetPanelCommonProps, TargetPanelNodeState> = (
    props: TargetPanelCommonProps,
    state: TargetPanelNodeState
  ) => {
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
      <div id="target-panel-node" className={classes(panelStyle, targetPanelStyle)}>
        <div className={panelHeadingStyle}>{renderNodeHeader(data, isExternal(data.cluster))}</div>
        <div className={panelBodyStyle}>
          {data.version && <div style={{ textAlign: 'left' }}>{`${t('Version')}: ${data.version}`}</div>}
          <span>{`${t('Configuration')}:`}</span>
          <pre>{JSON.stringify(data.infraData, null, 2)}</pre>
        </div>
      </div>
    );
  }
}
