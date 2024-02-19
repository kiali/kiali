import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { MeshTarget } from 'types/Mesh';
import { IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';

export interface TargetPanelCommonProps {
  istioAPIEnabled: boolean;
  kiosk: string;
  refreshInterval: IntervalInMilliseconds;
  target: MeshTarget;
  updateTime: TimeInMilliseconds;
}

export const targetPanelWidth = '35rem';

export const targetPanel = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  height: '100%',
  margin: 0,
  minWidth: targetPanelWidth,
  overflowY: 'scroll',
  padding: 0,
  position: 'relative',
  width: targetPanelWidth
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
  marginBottom: '23px',
  border: `1px solid ${PFColors.BorderColor100}`,
  borderRadius: '1px',
  '-webkit-box-shadow': '0 1px 1px rgba(0, 0, 0, 0.05)',
  boxShadow: '0 1px 1px rgba(0, 0, 0, 0.05)'
});

export const targetPanelFont: React.CSSProperties = {
  fontSize: 'var(--graph-side-panel--font-size)'
};

export const targetPanelHeading = kialiStyle({
  padding: '10px 15px',
  borderBottom: '1px solid transparent',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderColor: PFColors.BorderColor100
});

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
  margin: '1.0rem 0'
});

export const targetPanelHR = () => {
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
