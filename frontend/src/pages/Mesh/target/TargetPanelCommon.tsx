import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { MeshAttr, MeshInfraType, MeshNodeData, MeshTarget } from 'types/Mesh';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { ValidationTypes } from 'types/IstioObjects';
import { Status, statusMsg } from 'types/IstioStatus';
import { Validation } from 'components/Validations/Validation';
import { Title, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { t } from 'utils/I18nUtils';
import { PFBadge, PFBadges, PFBadgeType } from 'components/Pf/PfBadges';
import { AmbientLabel, tooltipMsgType } from '../../../components/Ambient/AmbientLabel';
import { serverConfig } from '../../../config';
import { KialiPageLink } from 'components/Link/KialiPageLink';
import { classes } from 'typestyle';
import { UNKNOWN } from 'types/Graph';
import { elems, selectAnd } from 'helpers/GraphHelpers';
import { Controller } from '@patternfly/react-topology';

export interface TargetPanelCommonProps {
  duration: DurationInSeconds;
  istioAPIEnabled: boolean;
  kiosk: string;
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

export const targetPanelHR = <hr className={hrStyle} />;
export const targetPanelUnderlineHR = <hr className={hrStyle} style={{ marginTop: 0 }} />;

export const shouldRefreshData = (prevProps: TargetPanelCommonProps, nextProps: TargetPanelCommonProps): boolean => {
  return (
    // Verify the time of the last request
    prevProps.updateTime !== nextProps.updateTime ||
    // Check if going from no data to data
    (!prevProps.target && nextProps.target) ||
    // Check if the target changed
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
    case MeshInfraType.TRACE_STORE:
      pfBadge = PFBadges.TraceStore;
      break;
    case MeshInfraType.WAYPOINT:
      pfBadge = PFBadges.Waypoint;
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

export const renderInfraSummary = (
  controller: Controller,
  forCluster?: string,
  forNamespace?: string
): React.ReactNode => {
  const { nodes } = elems(controller);

  const clusterAndExternalNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.CLUSTER }]);
  const clusterNodes = clusterAndExternalNodes.filter(rcn => !rcn.getData().isExternal);
  let controlPlaneNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.ISTIOD }]);
  let dataPlaneNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.DATAPLANE }]);
  let gatewayNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.GATEWAY }]);
  let kialiNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.KIALI }]);
  let observeNodes = [
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.GRAFANA }]),
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.METRIC_STORE }]),
    ...selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.TRACE_STORE }])
  ];
  let waypointNodes = selectAnd(nodes, [{ prop: MeshAttr.infraType, op: '=', val: MeshInfraType.WAYPOINT }]);

  if (forCluster) {
    controlPlaneNodes = controlPlaneNodes.filter(
      n => n.getData().cluster === forCluster && (!forNamespace || n.getData().namespace === forNamespace)
    );
    dataPlaneNodes = dataPlaneNodes.filter(
      n => n.getData().cluster === forCluster && (!forNamespace || n.getData().namespace === forNamespace)
    );
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

  return (
    <div id="target-panel-mesh-body" className={targetBodyStyle} style={{ paddingTop: 0 }}>
      {!forCluster && (
        <div className={infraStyle}>
          {t('Clusters: {{num}}', { num: clusterNodes.length })}
          {clusterNodes.map(infra => renderClusterSummary(infra.getData()))}
        </div>
      )}

      <div className={infraStyle}>
        {controlPlaneNodes.length > 0 && t('ControlPlanes: {{num}}', { num: controlPlaneNodes.length })}
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
  );
};
