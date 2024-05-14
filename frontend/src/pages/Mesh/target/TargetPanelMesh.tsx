import * as React from 'react';
import { Node, NodeModel, Visualization } from '@patternfly/react-topology';
import { TargetPanelCommonProps, getTitle, renderNodeHeader, targetPanelStyle } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { elems, selectAnd } from '../MeshElems';
import { MeshAttr, MeshInfraType, MeshNodeData } from 'types/Mesh';
import { kialiStyle } from 'styles/StyleUtils';

type TargetPanelMeshProps = TargetPanelCommonProps;

const infoStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const summaryStyle = kialiStyle({
  marginLeft: '0.5rem'
});

export const TargetPanelMesh: React.FC<TargetPanelMeshProps> = (props: TargetPanelMeshProps) => {
  const renderMeshSummary = (nodes: Node<NodeModel>[], clusterData: MeshNodeData): React.ReactNode => {
    const dataPlaneNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.DATAPLANE }]);

    const infraNodes = selectAnd(nodes, [
      { prop: MeshAttr.infraType, op: '!=', val: MeshInfraType.CLUSTER },
      { prop: MeshAttr.infraType, op: '!=', val: MeshInfraType.NAMESPACE },
      { prop: MeshAttr.infraType, op: '!=', val: MeshInfraType.DATAPLANE },
      { prop: MeshAttr.infraType, op: '!=', val: '' }
    ]);

    // get cluster data planes to check if we have to show canary info (more than 1 dataplane per cluster)
    const clusterDataPlanes = dataPlaneNodes.filter(node => node.getData().cluster === clusterData.cluster);

    return (
      <div style={{ marginBottom: '1rem' }}>
        {renderNodeHeader(clusterData, true)}
        <div className={infoStyle}>
          {clusterData.version && `Version: ${clusterData.version}`}
          {infraNodes
            .filter(node => node.getData().cluster === clusterData.cluster)
            .map(node => renderInfraNodeSummary(node.getData()))}
          {clusterDataPlanes.map(node => renderDataPlaneSummary(node.getData(), clusterDataPlanes.length > 1))}
        </div>
      </div>
    );
  };

  const renderInfraNodeSummary = (nodeData: MeshNodeData): React.ReactNode => {
    return (
      <div className={summaryStyle}>
        {renderNodeHeader(nodeData, true, true)}
        <div className={infoStyle}>
          {nodeData.version && `Version: ${nodeData.version}`}
          <br />
          {nodeData.namespace && `Namespace: ${nodeData.namespace}`}
        </div>
      </div>
    );
  };

  const renderDataPlaneSummary = (nodeData: MeshNodeData, showCanaryInfo: boolean): React.ReactNode => {
    return (
      <div className={summaryStyle}>
        {renderNodeHeader(nodeData, true, true)}
        <div className={infoStyle}>
          {showCanaryInfo && (
            <>
              {`Canary: ${nodeData.isCanary ?? false}`}
              <br />
              {nodeData.version && `Revision: ${nodeData.version}`}
              <br />
            </>
          )}

          {`${nodeData.infraData.length} namespaces`}
        </div>
      </div>
    );
  };

  const controller = props.target.elem as Visualization;

  if (!controller) {
    return null;
  }

  const { nodes } = elems(controller);

  const clusterNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.CLUSTER }]);

  return (
    <div id="target-panel-mesh" className={classes(panelStyle, targetPanelStyle)}>
      <div id="target-panel-mesh-heading" className={panelHeadingStyle}>
        {getTitle(`Mesh Name: ${controller.getGraph().getData().meshData.name}`)}
      </div>
      <div id="target-panel-mesh-body" className={panelBodyStyle}>
        {clusterNodes.map(cluster => renderMeshSummary(nodes, cluster.getData()))}
      </div>
    </div>
  );
};
