import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { MeshInfraType, MeshNodeData, MeshTarget } from 'types/Mesh';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { ValidationTypes } from 'types/IstioObjects';
import { Status, statusMsg } from 'types/IstioStatus';
import { Validation } from 'components/Validations/Validation';
import { Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { t } from 'utils/I18nUtils';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { AmbientLabel, tooltipMsgType } from '../../../components/Ambient/AmbientLabel';
import { serverConfig } from '../../../config';

export interface TargetPanelCommonProps {
  duration: DurationInSeconds;
  istioAPIEnabled: boolean;
  kiosk: string;
  refreshInterval: IntervalInMilliseconds;
  target: MeshTarget;
  updateTime: TimeInMilliseconds;
}

export const targetPanelWidth = '35rem';

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

export const targetPanelTitle = kialiStyle({
  fontWeight: 'bolder',
  marginTop: '0.25rem',
  marginBottom: '0.25rem',
  textAlign: 'left'
});

const healthStatusStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const hrStyle = kialiStyle({
  border: 0,
  borderTop: `1px solid ${PFColors.BorderColor100}`,
  margin: '1rem 0'
});

export const targetPanelHR = <hr className={hrStyle} />;

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

export const getTitle = (title: string): React.ReactNode => {
  return (
    <div className={targetPanelTitle}>
      {title}
      <br />
    </div>
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
  options: NodeHeaderOptions = { nameOnly: false, smallSize: false, hideBadge: false }
): React.ReactNode => {
  let pfBadge = PFBadges.Unknown;

  switch (data.infraType) {
    case MeshInfraType.CLUSTER:
      pfBadge = PFBadges.Cluster;
      break;
    case MeshInfraType.DATAPLANE:
      pfBadge = PFBadges.DataPlane;
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
  }

  return (
    <React.Fragment key={data.infraName}>
      <Title headingLevel="h5" size={options.smallSize ? TitleSizes.md : TitleSizes.lg}>
        <span className={nodeStyle}>
          {!options.hideBadge && <PFBadge badge={pfBadge} size={options.smallSize ? 'sm' : 'global'} />}

          {data.infraName}

          {renderHealthStatus(data)}
          {serverConfig.ambientEnabled && data.infraName === 'istiod' && <AmbientLabel tooltip={tooltipMsgType.mesh} />}
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
    </React.Fragment>
  );
};
