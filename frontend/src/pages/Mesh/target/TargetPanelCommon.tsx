import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { MeshAttr, MeshInfraType, MeshNodeData, MeshTarget } from 'types/Mesh';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { ValidationTypes } from 'types/IstioObjects';
import { Status, statusMsg } from 'types/IstioStatus';
import { Validation } from 'components/Validations/Validation';
import { Title, Tooltip, TooltipPosition, SearchInput, Tabs, Tab, TabTitleText } from '@patternfly/react-core';
import { ExpandableRowContent, Table, Tbody, Td, Tr } from '@patternfly/react-table';
import { t } from 'utils/I18nUtils';
import { PFBadge, PFBadges, PFBadgeType } from 'components/Pf/PfBadges';
import { AmbientLabel, tooltipMsgType } from '../../../components/Ambient/AmbientLabel';
import { serverConfig } from '../../../config';
import { KialiPageLink } from 'components/Link/KialiPageLink';
import { classes } from 'typestyle';
import { UNKNOWN } from 'types/Graph';
import { elems, selectAnd } from 'helpers/GraphHelpers';
import { Controller, Node } from '@patternfly/react-topology';
import { MeshData } from '../MeshPage';
import { panelHeadingStyle } from '../../Graph/SummaryPanelStyle';

export interface TargetPanelCommonProps {
  duration: DurationInSeconds;
  istioAPIEnabled: boolean;
  kiosk: string;
  meshData: MeshData;
  refreshInterval: IntervalInMilliseconds;
  target: MeshTarget;
  updateTime: TimeInMilliseconds;
}

export const targetPanelWidth = '35rem';

export const targetBodyStyle = kialiStyle({
  borderBottom: `1px solid ${PFColors.BorderColor100}`,
  padding: '0.75rem 1rem'
});

export const targetPanelStyle = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  height: '100%',
  margin: 0,
  minWidth: targetPanelWidth,
  overflowY: 'auto',
  padding: 0,
  position: 'relative',
  width: targetPanelWidth
});

export const targetPanelFont: React.CSSProperties = {
  fontSize: 'var(--graph-side-panel--font-size)'
};

const healthStatusStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const hrStyle = kialiStyle({
  border: 0,
  borderTop: `1px solid ${PFColors.BorderColor100}`,
  margin: '0.75rem 0'
});

export const summaryTitle = kialiStyle({
  fontWeight: 'bolder',
  marginTop: '0.25rem',
  marginBottom: '0.25rem',
  textAlign: 'left'
});

export const getMeshId = (nodeData: MeshNodeData): string => {
  return (
    nodeData.infraData.config?.standardConfig.configMap.mesh.defaultConfig.meshId ||
    nodeData.infraData.config?.standardConfig.configMap.mesh.trustDomain ||
    t('Istio mesh')
  );
};

export const targetPanelHR = <hr className={hrStyle} />;
export const targetPanelUnderlineHR = <hr className={hrStyle} style={{ marginTop: 0 }} />;

export const shouldRefreshData = (prevProps: TargetPanelCommonProps, nextProps: TargetPanelCommonProps): boolean => {
  return (
    // Verify the time of the last request
    prevProps.updateTime !== nextProps.updateTime ||
    // Check if going from no target to target
    (!prevProps.target && nextProps.target) ||
    // Check if the target elem changed
    prevProps.target.elem !== nextProps.target.elem
  );
};

export const renderHealthStatus = (data: MeshNodeData): React.ReactNode => {
  // Clusters and data planes do not display health status
  if (data.infraType === MeshInfraType.CLUSTER || data.infraType === MeshInfraType.DATAPLANE) {
    return null;
  }

  let healthSeverity: ValidationTypes;

  switch (data.healthData) {
    case Status.Healthy:
      healthSeverity = ValidationTypes.Correct;
      break;
    case Status.NotReady:
      healthSeverity = ValidationTypes.Warning;
      break;
    default:
      healthSeverity = ValidationTypes.Error;
  }

  return (
    <>
      {data.healthData && (
        <Tooltip
          aria-label={t('Health status')}
          position={TooltipPosition.right}
          enableFlip={true}
          content={<>{t(statusMsg[data.healthData])}</>}
        >
          <span className={healthStatusStyle}>
            <Validation severity={healthSeverity} />
          </span>
        </Tooltip>
      )}
    </>
  );
};

export const nodeStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

const meshTitleStyle = kialiStyle({
  fontWeight: 'bold',
  fontSize: '0.875rem'
});

const expandTitleStyle = kialiStyle({
  fontWeight: 'bold',
  fontSize: '0.875rem',
  paddingLeft: '0 !important',
  paddingTop: '0.75rem !important'
});

const expandBodyStyle = kialiStyle({
  padding: '0 0 0 0.125rem !important',
  $nest: {
    '& .pf-v6-c-table__expandable-row-content': {
      padding: '0 0 0 1.5rem !important'
    }
  }
});

interface NodeHeaderOptions {
  hideBadge?: boolean;
  nameOnly?: boolean;
  smallSize?: boolean;
}

export const renderNodeHeader = (
  data: MeshNodeData,
  options: NodeHeaderOptions = { nameOnly: false, smallSize: false, hideBadge: false },
  style?: string
): React.ReactNode => {
  let pfBadge = PFBadges.Unknown;

  switch (data.infraType) {
    case MeshInfraType.CLUSTER:
      pfBadge = PFBadges.Cluster;
      break;
    case MeshInfraType.DATAPLANE:
      pfBadge = PFBadges.DataPlane;
      break;
    case MeshInfraType.ISTIOD:
      pfBadge = PFBadges.Istio;
      break;
    case MeshInfraType.GATEWAY:
      pfBadge = PFBadges.Gateway;
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
    case MeshInfraType.PERSES:
      pfBadge = PFBadges.Perses;
      break;
    case MeshInfraType.TRACE_STORE:
      pfBadge = PFBadges.TraceStore;
      break;
    case MeshInfraType.WAYPOINT:
      pfBadge = PFBadges.Waypoint;
      break;
    case MeshInfraType.ZTUNNEL:
      pfBadge = PFBadges.Ztunnel;
      break;
    default:
      console.warn(`MeshElems: Unexpected infraType [${data.infraType}] `);
  }

  const link = options.nameOnly ? undefined : renderNodeLink(data);

  return (
    <React.Fragment key={data.infraName}>
      <Title headingLevel="h5">
        <span className={classes(nodeStyle, style)}>
          {!options.hideBadge && <PFBadge badge={pfBadge} size={options.smallSize ? 'sm' : 'global'} />}

          {data.infraName}

          {renderHealthStatus(data)}
          {serverConfig.ambientEnabled && data.infraType === MeshInfraType.ISTIOD && (
            <AmbientLabel tooltip={tooltipMsgType.mesh} />
          )}
        </span>
      </Title>
      {!options.nameOnly && (
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
      {link}
    </React.Fragment>
  );
};

const badgeStyle = kialiStyle({
  display: 'inline-block',
  marginRight: '0.25rem',
  marginBottom: '0.25rem'
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

const infraStyle = kialiStyle({
  marginTop: '0.75rem'
});

export const renderNodeLink = (meshData: MeshNodeData, style?: string): React.ReactNode | undefined => {
  let displayName, key, link: string;
  let pfBadge: PFBadgeType;

  switch (meshData.infraType) {
    case MeshInfraType.GATEWAY:
      const gatewayClassName = meshData.infraData?.spec?.gatewayClassName;
      const name = gatewayClassName ? `${meshData.infraName}-${gatewayClassName}` : meshData.infraName;
      link = `/namespaces/${encodeURIComponent(meshData.namespace)}/workloads/${encodeURIComponent(name)}`;
      key = `${meshData.namespace}.wl.${name}`;
      displayName = name;
      pfBadge = PFBadges.Workload;
      break;
    case MeshInfraType.WAYPOINT:
    case MeshInfraType.ZTUNNEL:
    case MeshInfraType.KIALI:
      link = `/namespaces/${encodeURIComponent(meshData.namespace)}/workloads/${encodeURIComponent(
        meshData.infraName
      )}`;
      key = `${meshData.namespace}.wl.${meshData.infraName}`;
      displayName = meshData.infraName;
      pfBadge = PFBadges.Workload;
      break;
    default:
      return undefined;
  }

  if (link) {
    return (
      <div key={`badged-${key}}`} className={style}>
        <span className={badgeStyle}>
          <PFBadge badge={pfBadge} size="sm" tooltip={PFBadges.Workload.tt} />
          <KialiPageLink key={key} href={link} cluster={meshData.cluster}>
            {displayName}
          </KialiPageLink>
        </span>
      </div>
    );
  }

  return undefined;
};

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

export const renderControlPlaneSummary = (nodeData: MeshNodeData, dataPlaneNamespaceCount: number): React.ReactNode => {
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

export const renderGatewaySummary = (nodeData: MeshNodeData): React.ReactNode => {
  const apiVersion = nodeData.infraData.apiVersion;
  return (
    <div key={nodeData.id} className={summaryStyle}>
      {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true }, summaryHeaderStyle)}
      <div className={summaryInfoStyle}>
        {apiVersion && <div>{t('api version: {{apiVersion}}', { apiVersion: apiVersion })}</div>}
        <div>{t('revision: {{revision}}', { revision: nodeData.infraData.revision || t('default') })}</div>
      </div>
    </div>
  );
};

export const renderKialiSummary = (nodeData: MeshNodeData): React.ReactNode => {
  return (
    <div key={nodeData.id} className={summaryStyle}>
      {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true }, summaryHeaderStyle)}
      <div className={summaryInfoStyle}>
        <div>{t('version: {{version}}', { version: nodeData.version })}</div>
      </div>
    </div>
  );
};

export const renderObservabilitySummary = (nodeData: MeshNodeData): React.ReactNode => {
  return (
    <div key={nodeData.id} className={summaryStyle}>
      {renderNodeHeader(nodeData, { nameOnly: true, smallSize: true }, summaryHeaderStyle)}
      <div className={summaryInfoStyle}>
        <div>{t('version: {{version}}', { version: nodeData.version })}</div>
      </div>
    </div>
  );
};

// Helper function to filter nodes by mesh name
const filterNodesByMesh = (nodes: Node[], meshName: string): Node[] => {
  return nodes.filter(infra => getMeshId(infra.getData()) === meshName);
};

// Helper function to filter shared infrastructure nodes (not mesh-specific)
// Based on data analysis: only control planes have explicit mesh associations
// Everything else (Kiali, external observability, data planes) are shared
const filterSharedInfrastructureNodes = (nodes: Node[]): Node[] => {
  return nodes.filter(infra => {
    const data = infra.getData();
    // External observability tools (no mesh association)
    if (
      data.isExternal === true &&
      (data.infraType === 'grafana' ||
        data.infraType === 'metricStore' ||
        data.infraType === 'traceStore' ||
        data.infraType === 'perses')
    ) {
      return true;
    }
    // Kiali (no mesh association in data)
    if (data.infraType === 'kiali') {
      return true;
    }
    // Data planes (associated by revision, not mesh)
    if (data.infraType === 'dataplane') {
      return true;
    }
    // Gateways and waypoints (when they exist, likely shared)
    if (data.infraType === 'gateway' || data.infraType === 'waypoint') {
      return true;
    }
    return false;
  });
};

// Helper function to render mesh control planes content
const renderMeshControlPlanes = (
  meshName: string,
  controlPlaneNodes: Node[],
  dataPlaneNodes: Node[]
): React.ReactNode => {
  const meshControlPlanes = filterNodesByMesh(controlPlaneNodes, meshName);

  return (
    <div key={meshName} style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
      {t('ControlPlanes: {{num}}', { num: meshControlPlanes.length })}
      <div>
        {meshControlPlanes.map(infra => {
          const cpRev = infra.getData().infraData.revision ?? 'default';
          const dataPlaneNode = dataPlaneNodes.find(dpn => {
            const dpRev = dpn.getData().version ?? 'default';
            return cpRev === dpRev;
          });
          const dataPlaneNamespaceCount = dataPlaneNode?.getData().infraData?.length ?? 0;
          return renderControlPlaneSummary(infra.getData(), dataPlaneNamespaceCount);
        })}
      </div>
    </div>
  );
};

// Helper function to render shared infrastructure content
const renderSharedInfrastructure = (
  clusterNodes: Node[],
  gatewayNodes: Node[],
  waypointNodes: Node[],
  kialiNodes: Node[],
  observeNodes: Node[],
  forCluster?: string
): React.ReactNode => {
  // Everything is shared infrastructure (no mesh associations in data)
  const sharedGateways = filterSharedInfrastructureNodes(gatewayNodes);
  const sharedKiali = filterSharedInfrastructureNodes(kialiNodes);
  const sharedObserve = filterSharedInfrastructureNodes(observeNodes);
  const sharedWaypoints = filterSharedInfrastructureNodes(waypointNodes);

  return (
    <div id="target-panel-mesh-body" className={targetBodyStyle} style={{ paddingTop: 0 }}>
      {!forCluster && (
        <div className={infraStyle}>
          {t('Clusters: {{num}}', { num: clusterNodes.length })}
          {clusterNodes.map(infra => renderClusterSummary(infra.getData()))}
        </div>
      )}

      <div className={infraStyle}>
        {sharedGateways.length > 0 && t('Gateways: {{num}}', { num: sharedGateways.length })}
        {sharedGateways.map(infra => renderGatewaySummary(infra.getData()))}
      </div>

      <div className={infraStyle}>
        {sharedWaypoints.length > 0 && t('Waypoints: {{num}}', { num: sharedWaypoints.length })}
        {sharedWaypoints.map(infra => renderGatewaySummary(infra.getData()))}
      </div>

      <div className={infraStyle}>
        {sharedKiali.length > 0 && t('Kiali: {{num}}', { num: sharedKiali.length })}
        {sharedKiali.map(infra => renderKialiSummary(infra.getData()))}
      </div>

      <div className={infraStyle}>
        {sharedObserve.length > 0 && t('Observability: {{num}}', { num: sharedObserve.length })}
        {sharedObserve.map(infra => renderObservabilitySummary(infra.getData()))}
      </div>
    </div>
  );
};

// Component for mesh expandable table
const MeshTabsComponent: React.FC<{
  clusterNodes: Node[];
  controlPlaneNodes: Node[];
  dataPlaneNodes: Node[];
  forCluster?: string;
  gatewayNodes: Node[];
  kialiNodes: Node[];
  meshData: MeshData;
  observeNodes: Node[];
  waypointNodes: Node[];
}> = ({
  meshData,
  clusterNodes,
  controlPlaneNodes,
  dataPlaneNodes,
  gatewayNodes,
  waypointNodes,
  kialiNodes,
  observeNodes,
  forCluster
}) => {
  const [expanded, setExpanded] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState<string>('');
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0);

  const isExpanded = (meshName: string): boolean => {
    return expanded.includes(meshName);
  };

  const toggleExpanded = (meshName: string): void => {
    const updatedExpanded = expanded.filter(n => meshName !== n);
    if (updatedExpanded.length === expanded.length) {
      updatedExpanded.push(meshName);
    }
    setExpanded(updatedExpanded);
  };

  // Filter out meshes that have no control planes
  const meshesWithControlPlanes = meshData.names.filter(meshName => {
    const meshControlPlanes = filterNodesByMesh(controlPlaneNodes, meshName);
    return meshControlPlanes.length > 0;
  });

  // If no meshes with control planes, render only shared infrastructure without tabs
  if (meshesWithControlPlanes.length === 0) {
    return (
      <div>
        {renderSharedInfrastructure(clusterNodes, gatewayNodes, waypointNodes, kialiNodes, observeNodes, forCluster)}
      </div>
    );
  }

  // If only one mesh has control planes, render without table
  if (meshesWithControlPlanes.length === 1) {
    const meshName = meshesWithControlPlanes[0];

    return (
      <div>
        <div className={targetBodyStyle}>
          <div className={meshTitleStyle}>{t('Mesh: {{meshName}}', { meshName })}</div>
        </div>
        {renderMeshControlPlanes(meshName, controlPlaneNodes, dataPlaneNodes)}

        {renderSharedInfrastructure(clusterNodes, gatewayNodes, waypointNodes, kialiNodes, observeNodes, forCluster)}
      </div>
    );
  }

  return (
    <div>
      <Tabs
        activeKey={activeTabKey}
        onSelect={(_event, tabIndex) => setActiveTabKey(tabIndex)}
        aria-label="Mesh tabs"
        data-test="mesh-tabs"
      >
        <Tab eventKey={0} title={<TabTitleText>{t('Overview')}</TabTitleText>}>
          {renderSharedInfrastructure(clusterNodes, gatewayNodes, waypointNodes, kialiNodes, observeNodes, forCluster)}
        </Tab>
        <Tab
          eventKey={1}
          title={<TabTitleText>{t('Meshes ({{count}})', { count: meshData.names.length })}</TabTitleText>}
        >
          <SearchInput
            placeholder="Filter meshes..."
            value={filter}
            onChange={(_event, value) => setFilter(value)}
            onClear={() => setFilter('')}
          />
          <Table aria-label="Mesh table" variant="compact">
            {meshesWithControlPlanes
              .filter(meshName => filter === '' || meshName.toLowerCase().includes(filter.toLowerCase()))
              .sort((a, b) => a.localeCompare(b))
              .map((meshName, i) => (
                <Tbody key={meshName} isExpanded={isExpanded(meshName)}>
                  <Tr>
                    <Td
                      expand={{
                        rowIndex: i,
                        isExpanded: isExpanded(meshName),
                        onToggle: () => toggleExpanded(meshName),
                        expandId: `mesh-${meshName}`
                      }}
                      style={{ paddingRight: '0.125rem' }}
                    />
                    <Td dataLabel={t('Mesh')} className={expandTitleStyle}>
                      {t('Mesh: {{meshName}}', { meshName })}
                    </Td>
                  </Tr>
                  <Tr isExpanded={isExpanded(meshName)}>
                    <Td dataLabel={`mesh-detail-${meshName}`} className={expandBodyStyle} colSpan={2}>
                      <ExpandableRowContent>
                        {renderMeshControlPlanes(meshName, controlPlaneNodes, dataPlaneNodes)}
                      </ExpandableRowContent>
                    </Td>
                  </Tr>
                </Tbody>
              ))}
          </Table>
        </Tab>
      </Tabs>
    </div>
  );
};

export const renderInfraSummary = (
  controller: Controller,
  meshData: MeshData,
  forCluster?: string,
  forNamespace?: string
): React.ReactNode => {
  const { nodes } = elems(controller);

  const clusterAndExternalNodes = selectAnd(nodes, [
    { prop: MeshAttr.infraType, op: '=', val: MeshInfraType.CLUSTER }
  ]) as Node[];
  const clusterNodes = clusterAndExternalNodes.filter(rcn => !rcn.getData().isExternal);
  let controlPlaneNodes = selectAnd(nodes, [
    { prop: MeshAttr.infraType, op: '=', val: MeshInfraType.ISTIOD }
  ]) as Node[];
  let dataPlaneNodes = selectAnd(nodes, [
    { prop: MeshAttr.infraType, op: '=', val: MeshInfraType.DATAPLANE }
  ]) as Node[];
  let gatewayNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.GATEWAY }]) as Node[];
  let kialiNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.KIALI }]) as Node[];
  let observeNodes = [
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.GRAFANA }]),
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.METRIC_STORE }]),
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.PERSES }]),
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.TRACE_STORE }])
  ] as Node[];
  let waypointNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.WAYPOINT }]) as Node[];

  if (forCluster) {
    controlPlaneNodes = controlPlaneNodes.filter(
      n => n.getData().cluster === forCluster && (!forNamespace || n.getData().namespace === forNamespace)
    );
    // 'infraType: dataplane' does not have a value for 'namespace', a filtering by 'revision' is used when displaying
    dataPlaneNodes = dataPlaneNodes.filter(n => n.getData().cluster === forCluster);
    gatewayNodes = gatewayNodes.filter(
      n => n.getData().cluster === forCluster && (!forNamespace || n.getData().namespace === forNamespace)
    );
    kialiNodes = kialiNodes.filter(
      n => n.getData().cluster === forCluster && (!forNamespace || n.getData().namespace === forNamespace)
    );
    observeNodes = observeNodes.filter(
      n => n.getData().cluster === forCluster && (!forNamespace || n.getData().namespace === forNamespace)
    );
    waypointNodes = waypointNodes.filter(
      n => n.getData().cluster === forCluster && (!forNamespace || n.getData().namespace === forNamespace)
    );
  }

  // If only one mesh, render without tabs
  if (meshData.names.length <= 1) {
    return (
      <div>
        <div id="target-panel-mesh-heading" className={panelHeadingStyle}>
          <div className={summaryTitle}>
            {t('Mesh: {{meshName}}', { meshName: meshData.names })}
            <br />
          </div>
        </div>
        {renderSharedInfrastructure(clusterNodes, gatewayNodes, waypointNodes, kialiNodes, observeNodes, forCluster)}
      </div>
    );
  }

  // Multiple meshes - render with tabs
  return (
    <MeshTabsComponent
      meshData={meshData}
      clusterNodes={clusterNodes}
      controlPlaneNodes={controlPlaneNodes}
      dataPlaneNodes={dataPlaneNodes}
      gatewayNodes={gatewayNodes}
      waypointNodes={waypointNodes}
      kialiNodes={kialiNodes}
      observeNodes={observeNodes}
      forCluster={forCluster}
    />
  );
};
