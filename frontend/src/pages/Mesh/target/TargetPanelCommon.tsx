import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { MeshTarget } from 'types/Mesh';
import { TimeInMilliseconds } from 'types/Common';

export interface TargetPanelCommonProps {
  kiosk: string;
  target: MeshTarget;
  updateTime: TimeInMilliseconds;
}

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

export const targetPanelWidth = '45rem';

export const targetPanelStyle = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  height: '100%',
  margin: 0,
  minWidth: targetPanelWidth,
  overflowY: 'scroll',
  padding: 0,
  position: 'relative',
  width: targetPanelWidth
});

const hrStyle = kialiStyle({
  border: 0,
  borderTop: `1px solid ${PFColors.BorderColor100}`,
  margin: '0.5rem 0'
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
