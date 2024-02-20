import * as React from 'react';
import { GraphElement, Visualization } from '@patternfly/react-topology';
import {
  TargetPanelCommonProps,
  getTitle,
  renderNode,
  targetPanelStyle,
  targetPanelHeading,
  targetPanelWidth
} from './TargetPanelCommon';
import { elems, select, selectAnd } from '../MeshElems';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { MeshAttr, MeshInfraType } from 'types/Mesh';

type TargetPanelMeshState = {
  loading: boolean;
  mesh: any;
};

const defaultState: TargetPanelMeshState = {
  mesh: null,
  loading: false
};

const meshStyle = kialiStyle({
  marginLeft: '0.25rem',
  marginRight: '0.5rem'
});

export class TargetPanelMesh extends React.Component<TargetPanelCommonProps, TargetPanelMeshState> {
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

  static getDerivedStateFromProps = (
    props: TargetPanelCommonProps,
    state: TargetPanelMeshState
  ): TargetPanelMeshState | null => {
    // if the target (i.e. mesh) has changed, then init the state and set to loading. The loading
    // will actually be kicked off after the render (in componentDidMount/Update).
    return props.target.elem !== state.mesh ? { mesh: props.target.elem, loading: true } : null;
  };

  componentDidMount = (): void => {};

  componentDidUpdate = (_prevProps: TargetPanelCommonProps): void => {};

  componentWillUnmount = (): void => {};

  render = (): React.ReactNode => {
    const controller = this.props.target.elem as Visualization;

    if (!controller) {
      return null;
    }

    const { nodes } = elems(controller);

    const infraNodes = selectAnd(nodes, [
      { prop: MeshAttr.infraType, op: '!=', val: MeshInfraType.CLUSTER },
      { prop: MeshAttr.infraType, op: '!=', val: MeshInfraType.NAMESPACE },
      { prop: MeshAttr.infraType, op: '!=', val: '' }
    ]);

    const numClusters = select(nodes, { prop: MeshAttr.infraType, val: MeshInfraType.CLUSTER }).length;
    const numNamespaces = select(nodes, { prop: MeshAttr.infraType, val: MeshInfraType.NAMESPACE }).length;

    return (
      <div id="target-panel-mesh" className={targetPanelStyle} style={TargetPanelMesh.panelStyle}>
        <div id="summary-panel-graph-heading" className={targetPanelHeading}>
          {getTitle('Current Mesh')}
          {this.renderMeshSummary(infraNodes, numClusters, numNamespaces)}
        </div>
      </div>
    );
  };

  private renderMeshSummary = (
    infraNodes: GraphElement[],
    numClusters: number,
    numNamespaces: number
  ): React.ReactNode => (
    <>
      <div style={{ marginBottom: '1rem' }}>{infraNodes.map(node => this.renderInfraNode(node))}</div>
      {numClusters > 0 && (
        <div>
          <KialiIcon.Services className={meshStyle} />
          {numClusters.toString()} {numClusters === 1 ? 'cluster' : 'clusters'}
        </div>
      )}

      {numNamespaces > 0 && (
        <div>
          <KialiIcon.Workloads className={meshStyle} />
          {numNamespaces.toString()} {numNamespaces === 1 ? 'namespace' : 'namespaces'}
        </div>
      )}
    </>
  );

  private renderInfraNode = (infraNode: GraphElement): React.ReactNode => {
    const data = infraNode.getData();
    const name = data[MeshAttr.infraName];
    const type = data[MeshAttr.infraType];

    return renderNode(name, type);
  };
}
