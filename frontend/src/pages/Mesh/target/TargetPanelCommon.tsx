import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { MeshInfraType, MeshTarget } from 'types/Mesh';
import { IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { PFBadge, PFBadgeType, PFBadges } from 'components/Pf/PfBadges';

export interface TargetPanelCommonProps {
  istioAPIEnabled: boolean;
  kiosk: string;
  refreshInterval: IntervalInMilliseconds;
  target: MeshTarget;
  updateTime: TimeInMilliseconds;
}

export const targetPanelWidth = '35rem';

export const panelStyle = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  height: '100%',
  margin: 0,
  minWidth: targetPanelWidth,
  overflowY: 'scroll',
  padding: 0,
  position: 'relative',
  width: targetPanelWidth
});

export const targetPanelStyle = kialiStyle({
  marginBottom: '1.5rem',
  border: `1px solid ${PFColors.BorderColor100}`,
  borderRadius: '1px',
  '-webkit-box-shadow': '0 1px 1px rgba(0, 0, 0, 0.05)',
  boxShadow: '0 1px 1px rgba(0, 0, 0, 0.05)'
});

export const targetPanelHeading = kialiStyle({
  padding: '0.5rem 1rem',
  borderBottom: '1px solid transparent',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderColor: PFColors.BorderColor100
});

export const targetPanelBodyStyle = kialiStyle({
  padding: '15px',
  $nest: {
    '&:after, &:before': {
      display: 'table',
      content: ' '
    },

    '&:after': {
      clear: 'both'
    }
  }
});

export const targetPanelBorder = kialiStyle({
  marginBottom: '1.5rem',
  border: `1px solid ${PFColors.BorderColor100}`,
  borderRadius: '1px',
  '-webkit-box-shadow': '0 1px 1px rgba(0, 0, 0, 0.05)',
  boxShadow: '0 1px 1px rgba(0, 0, 0, 0.05)'
});

export const targetPanelFont: React.CSSProperties = {
  fontSize: 'var(--graph-side-panel--font-size)'
};

export const TargetPanelTabs = kialiStyle({
  padding: '0.5rem 1rem 0 1rem'
});

export const targetPanelTitle = kialiStyle({
  fontWeight: 'bolder',
  marginTop: '0.25rem',
  marginBottom: '0.25rem',
  textAlign: 'left'
});

const hrStyle = kialiStyle({
  border: 0,
  borderTop: `1px solid ${PFColors.BorderColor100}`,
  margin: '1rem 0'
});

export const targetPanelHR = (): React.ReactNode => {
  return <hr className={hrStyle} />;
};

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

const nodeStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex'
});

export const renderNode = (infraName: string, infraType: MeshInfraType): React.ReactNode => {
  let pfBadge: PFBadgeType;

  switch (infraType) {
    case MeshInfraType.CLUSTER:
      pfBadge = PFBadges.Cluster;
      break;
    case MeshInfraType.GRAFANA:
      pfBadge = PFBadges.Grafana;
      break;
    case MeshInfraType.ISTIOD:
      pfBadge = PFBadges.Istio;
      break;
    case MeshInfraType.KIALI:
      pfBadge = PFBadges.Kiali;
      break;
    case MeshInfraType.METRIC_STORE:
      pfBadge = PFBadges.MetricStore;
      break;
    case MeshInfraType.NAMESPACE:
      pfBadge = PFBadges.Namespace;
      break;
    case MeshInfraType.TRACE_STORE:
      pfBadge = PFBadges.TraceStore;
      break;
    default:
      pfBadge = PFBadges.Unknown;
      console.warn(`MeshElems: Unexpected infraType [${infraType}] `);
  }

  return (
    <React.Fragment key={infraName}>
      <span className={nodeStyle}>
        <PFBadge badge={pfBadge} size="sm" />
        {infraName}{' '}
      </span>
    </React.Fragment>
  );
};
