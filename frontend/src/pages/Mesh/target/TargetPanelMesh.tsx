import * as React from 'react';
import { Node, NodeModel, Visualization } from '@patternfly/react-topology';
import { TargetPanelCommonProps, getTitle, renderNodeHeader, targetPanelStyle } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { elems, selectAnd } from 'helpers/GraphHelpers';
import { DataPlaneNodeData, MeshAttr, MeshInfraType, MeshNodeData } from 'types/Mesh';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';

type TargetPanelMeshProps = TargetPanelCommonProps;

const infoStyle = kialiStyle({
  marginLeft: '1.0rem'
});

const summaryStyle = kialiStyle({
  marginTop: '0.25rem'
});

export const TargetPanelMesh: React.FC<TargetPanelMeshProps> = (props: TargetPanelMeshProps) => {
  const { t } = useKialiTranslation();

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
      <div key={clusterData.id} style={{ marginBottom: '1rem' }}>
        {renderNodeHeader(clusterData, { nameOnly: true, smallSize: false, hideBadge: clusterData.isExternal })}
        <div className={infoStyle}>
          {!clusterData.isExternal && `Kubernetes: ${clusterData.version || t(UNKNOWN)}`}

          {infraNodes
            .filter(node => node.getData().cluster === clusterData.cluster)
            .sort((in1, in2) => {
              const data1 = in1.getData();
              const data2 = in2.getData();

              if (data1.infraType === MeshInfraType.ISTIOD) {
                return -1;
              }

              if (data2.infraType === MeshInfraType.ISTIOD) {
                return 1;
              }

              return data1.infraName.toLowerCase() < data2.infraName.toLowerCase() ? -1 : 1;
            })
            .map(node => renderInfraNodeSummary(node.getData()))}

          {clusterDataPlanes.map(node => renderDataPlaneSummary(node.getData()))}
        </div>
      </div>
    );
  };

  const renderInfraNodeSummary = (nodeData: MeshNodeData): React.ReactNode => {
    return (
      <div key={nodeData.id} className={summaryStyle}>
        {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true })}

        <div className={infoStyle}>
          <div>{t('Version: {{version}}', { version: nodeData.version || t(UNKNOWN) })}</div>

          {nodeData.infraType === MeshInfraType.ISTIOD && nodeData.namespace && (
            <div>{t('Namespace: {{namespace}}', { namespace: nodeData.namespace })}</div>
          )}
        </div>
      </div>
    );
  };

  const renderDataPlaneSummary = (nodeData: DataPlaneNodeData): React.ReactNode => {
    return (
      <div key={nodeData.id} className={summaryStyle}>
        {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true })}

        <div className={infoStyle}>
          {nodeData.version && <div>{t('Revision: {{revision}}', { revision: nodeData.version })}</div>}

          {t('{{count}} namespace', {
            count: nodeData.infraData?.length,
            defaultValue_one: '{{count}} namespace',
            defaultValue_other: '{{count}} namespaces'
          })}
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
        {getTitle(t('Mesh Name: {{meshName}}', { meshName: controller.getGraph().getData().meshData.name }))}
      </div>

      <div id="target-panel-mesh-body" className={panelBodyStyle}>
        {clusterNodes.map(cluster => renderMeshSummary(nodes, cluster.getData()))}
      </div>
    </div>
  );
};
