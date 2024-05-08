import * as React from 'react';
import { GraphElement, Visualization } from '@patternfly/react-topology';
import { TargetPanelCommonProps, getTitle, targetPanelStyle } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { elems, selectAnd } from '../MeshElems';
import { MeshAttr, MeshInfraType } from 'types/Mesh';
import { renderNodeHeader } from './TargetPanelNode';
import { WithTranslation, withTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from 'types/Common';

type TargetPanelMeshState = {
  loading: boolean;
  mesh: any;
};

const defaultState: TargetPanelMeshState = {
  mesh: null,
  loading: false
};

type TargetPanelMeshProps = WithTranslation & TargetPanelCommonProps;

class TargetPanelMeshComponent extends React.Component<TargetPanelMeshProps, TargetPanelMeshState> {
  constructor(props: TargetPanelMeshProps) {
    super(props);

    this.state = { ...defaultState };
  }

  static getDerivedStateFromProps: React.GetDerivedStateFromProps<TargetPanelMeshProps, TargetPanelMeshState> = (
    props: TargetPanelCommonProps,
    state: TargetPanelMeshState
  ) => {
    // if the target (i.e. mesh) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.mesh ? { graph: props.target.elem, loading: true } : null;
  };

  render(): React.ReactNode {
    const controller = this.props.target.elem as Visualization;

    if (!controller) {
      return null;
    }

    const { nodes } = elems(controller);

    const infraNodes = selectAnd(nodes, [
      { prop: MeshAttr.infraType, op: '!=', val: MeshInfraType.CLUSTER },
      { prop: MeshAttr.infraType, op: '!=', val: MeshInfraType.NAMESPACE },
      { prop: MeshAttr.infraType, op: '!=', val: MeshInfraType.DATAPLANE },
      { prop: MeshAttr.infraType, op: '!=', val: '' }
    ]);

    return (
      <div id="target-panel-mesh" className={classes(panelStyle, targetPanelStyle)}>
        <div id="target-panel-mesh-heading" className={panelHeadingStyle}>
          {getTitle(`Mesh Name: ${controller.getGraph().getData().meshData.name}`)}
        </div>
        <div id="target-panel-mesh-body" className={panelBodyStyle}>
          {this.renderMeshSummary(infraNodes)}
        </div>
      </div>
    );
  }

  private renderMeshSummary = (infraNodes: GraphElement[]): React.ReactNode => (
    <>{infraNodes.map(node => renderNodeHeader(node.getData(), this.props.t, true))}</>
  );
}

export const TargetPanelMesh = withTranslation(I18N_NAMESPACE)(TargetPanelMeshComponent);
