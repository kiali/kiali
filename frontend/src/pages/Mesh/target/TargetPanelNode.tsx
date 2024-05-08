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
import { MeshInfraType, MeshNodeData, isExternal } from 'types/Mesh';
import { classes } from 'typestyle';
import { panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { Title, TitleSizes } from '@patternfly/react-core';
import { WithTranslation, withTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from 'types/Common';
import { TFunction } from 'react-i18next';

type TargetPanelNodeProps = WithTranslation & TargetPanelCommonProps;

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

export function renderNodeHeader(
  data: MeshNodeData,
  t: TFunction,
  nameOnly?: boolean,
  nameSize?: TitleSizes
): React.ReactNode {
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
    default:
      console.warn(`MeshElems: Unexpected infraType [${data.infraType}] `);
  }

  return (
    <React.Fragment key={data.infraName}>
      <Title headingLevel="h5" size={nameSize ?? TitleSizes.lg}>
        <span className={nodeStyle}>
          <PFBadge badge={pfBadge} size="global" />
          {data.infraName}
          {!nameOnly && getHealthStatus(data, t)}
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

class TargetPanelNodeComponent extends React.Component<TargetPanelNodeProps, TargetPanelNodeState> {
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
      <div id="target-panel-node" className={classes(panelStyle, targetPanel)}>
        <div className={targetPanelHeading}>{renderNodeHeader(data, this.props.t, isExternal(data.cluster))}</div>
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
}

export const TargetPanelNode = withTranslation(I18N_NAMESPACE)(TargetPanelNodeComponent);
