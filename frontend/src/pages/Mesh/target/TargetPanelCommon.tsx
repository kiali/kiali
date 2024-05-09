import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { MeshNodeData, MeshTarget } from 'types/Mesh';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds } from 'types/Common';
import { ValidationTypes } from 'types/IstioObjects';
import { Status, statusMsg } from 'types/IstioStatus';
import { Validation } from 'components/Validations/Validation';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { t } from 'utils/I18nUtils';

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

export const getHealthStatus = (data: MeshNodeData): React.ReactNode => {
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
