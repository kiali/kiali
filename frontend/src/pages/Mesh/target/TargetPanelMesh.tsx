import * as React from 'react';
import { Visualization } from '@patternfly/react-topology';
import { TargetPanelCommonProps, renderNodeHeader, targetPanelStyle } from './TargetPanelCommon';
import { classes } from 'typestyle';
import { panelBodyStyle, panelHeadingStyle, panelStyle } from 'pages/Graph/SummaryPanelStyle';
import { elems, selectAnd } from 'helpers/GraphHelpers';
import { MeshAttr, MeshInfraType, MeshNodeData } from 'types/Mesh';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import { UNKNOWN } from 'types/Graph';

type TargetPanelMeshProps = TargetPanelCommonProps;

const infraStyle = kialiStyle({
  marginTop: '0.75rem'
});

const summaryStyle = kialiStyle({
  marginBottom: '0.25rem'
});

const summaryHeaderStyle = kialiStyle({
  marginLeft: '0.75rem'
});

const summaryInfoStyle = kialiStyle({
  marginLeft: '2.0rem'
});

const targetPanelTitle = kialiStyle({
  fontWeight: 'bolder',
  marginTop: '0.25rem',
  marginBottom: '0.25rem',
  textAlign: 'left'
});

export const TargetPanelMesh: React.FC<TargetPanelMeshProps> = (props: TargetPanelMeshProps) => {
  const { t } = useKialiTranslation();

  const renderClusterSummary = (nodeData: MeshNodeData): React.ReactNode => {
    return (
      <div key={nodeData.id} className={summaryStyle}>
        {renderNodeHeader(
          nodeData,
          { nameOnly: true, smallSize: true, hideBadge: nodeData.isExternal },
          summaryHeaderStyle
        )}
        <div className={summaryInfoStyle}>
          {t('kubernetes version: {{version}}', { version: nodeData.version || t(UNKNOWN) })}
        </div>
      </div>
    );
  };

  const renderControlPlaneSummary = (nodeData: MeshNodeData, dataPlaneNamespaceCount: number): React.ReactNode => {
    return (
      <div key={nodeData.id} className={summaryStyle}>
        {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true }, summaryHeaderStyle)}
        <div className={summaryInfoStyle}>
          <div>{t('version: {{version}}', { version: nodeData.version || t(UNKNOWN) })}</div>
          <div>{t('revision: {{revision}}', { revision: nodeData.infraData.revision || t('default') })}</div>
          <div>
            {t('dataplane namespaces: {{count}}', {
              count: dataPlaneNamespaceCount
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderGatewaySummary = (nodeData: MeshNodeData): React.ReactNode => {
    return (
      <div key={nodeData.id} className={summaryStyle}>
        {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true }, summaryHeaderStyle)}
        <div className={summaryInfoStyle}>
          <div>{t('api version: {{apiVersion}}', { apiVersion: nodeData.infraData.apiVersion || t(UNKNOWN) })}</div>
          <div>{t('revision: {{revision}}', { revision: nodeData.infraData.revision || t('default') })}</div>
        </div>
      </div>
    );
  };

  const renderKialiSummary = (nodeData: MeshNodeData): React.ReactNode => {
    return (
      <div key={nodeData.id} className={summaryStyle}>
        {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true }, summaryHeaderStyle)}
        <div className={summaryInfoStyle}>
          <div>{t('version: {{version}}', { version: nodeData.version })}</div>
        </div>
      </div>
    );
  };

  const renderObservabilitySummary = (nodeData: MeshNodeData): React.ReactNode => {
    return (
      <div key={nodeData.id} className={summaryStyle}>
        {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true }, summaryHeaderStyle)}
        <div className={summaryInfoStyle}>
          <div>{t('version: {{version}}', { version: nodeData.version })}</div>
        </div>
      </div>
    );
  };

  const controller = props.target.elem as Visualization;

  if (!controller) {
    return null;
  }

  const { nodes } = elems(controller);

  const clusterAndExternalNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.CLUSTER }]);
  const clusterNodes = clusterAndExternalNodes.filter(rcn => !rcn.getData().isExternal);
  const controlPlaneNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.ISTIOD }]);
  const dataPlaneNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.DATAPLANE }]);
  const gatewayNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.GATEWAY }]);
  const kialiNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.KIALI }]);
  const observeNodes = [
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.GRAFANA }]),
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.METRIC_STORE }]),
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.TRACE_STORE }])
  ];
  const waypointNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.WAYPOINT }]);

  return (
    <div id="target-panel-mesh" className={classes(panelStyle, targetPanelStyle)}>
      <div id="target-panel-mesh-heading" className={panelHeadingStyle}>
        <div className={targetPanelTitle}>
          {t('Mesh: {{name}}', { name: controller.getGraph().getData().meshData.name })}
          <br />
        </div>
      </div>

      <div id="target-panel-mesh-body" className={panelBodyStyle}>
        <div className={infraStyle}>
          {t('Clusters: {{num}}', { num: clusterNodes.length })}
          {clusterNodes.map(infra => renderClusterSummary(infra.getData()))}
        </div>

        <div className={infraStyle}>
          {t('ControlPlanes: {{num}}', { num: controlPlaneNodes.length })}
          {controlPlaneNodes.map(infra => {
            const cpRev = infra.getData().infraData.revision ?? 'default';
            const dataPlaneNode = dataPlaneNodes.find(dpn => {
              const dpRev = dpn.getData().infraData.revision ?? 'default';
              return cpRev === dpRev;
            });
            const dataPlaneNamespaceCount = dataPlaneNode?.getData().infraData?.length ?? 0;
            return renderControlPlaneSummary(infra.getData(), dataPlaneNamespaceCount);
          })}
        </div>

        <div className={infraStyle}>
          {gatewayNodes.length > 0 && t('Gateways: {{num}}', { num: gatewayNodes.length })}
          {gatewayNodes.map(infra => renderGatewaySummary(infra.getData()))}
        </div>

        <div className={infraStyle}>
          {waypointNodes.length > 0 && t('Waypoints: {{num}}', { num: waypointNodes.length })}
          {waypointNodes.map(infra => renderGatewaySummary(infra.getData()))}
        </div>

        <div className={infraStyle}>
          {kialiNodes.length > 0 && t('Kiali: {{num}}', { num: kialiNodes.length })}
          {kialiNodes.map(infra => renderKialiSummary(infra.getData()))}
        </div>

        <div className={infraStyle}>
          {observeNodes.length > 0 && t('Observability: {{num}}', { num: observeNodes.length })}
          {observeNodes.map(infra => renderObservabilitySummary(infra.getData()))}
        </div>
      </div>
      <div id="target-panel-mesh-body" className={panelBodyStyle}></div>
    </div>
  );
};
