import * as React from 'react';
import { DEGRADED, FAILURE, HEALTHY, NOT_READY, NA, Status } from '../../types/Health';
import { NamespaceStatus } from '../../types/NamespaceInfo';
import { useKialiTranslation } from 'utils/I18nUtils';
import { createIcon } from '../../config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { DurationInSeconds, IntervalInMilliseconds } from '../../types/Common';
import { pluralize } from '@patternfly/react-core';
import { namespaceNaIconStyle, statusIconStyle, statusTextStyle } from './NamespaceStyle';
import { naTextStyle } from 'styles/HealthStyle';
import { classes } from 'typestyle';

type ReduxProps = {
  duration: DurationInSeconds;
  kiosk: string;
  refreshInterval: IntervalInMilliseconds;
};

type Props = ReduxProps & {
  name: string;
  statusApp?: NamespaceStatus;
  statusService?: NamespaceStatus;
  statusWorkload?: NamespaceStatus;
};

const NamespaceHealthStatusComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  // Get combined worst status across all three types
  const getCombinedWorstStatus = (): Status => {
    let worstStatus = NA;
    let worstPriority = 5; // Higher number = better status
    const statuses = [props.statusApp, props.statusService, props.statusWorkload];
    statuses.forEach(status => {
      if (status) {
        if (status.inError.length > 0 && worstPriority > 1) {
          worstStatus = FAILURE;
          worstPriority = 1;
        } else if (status.inWarning.length > 0 && worstPriority > 2) {
          worstStatus = DEGRADED;
          worstPriority = 2;
        } else if (status.inNotReady.length > 0 && worstPriority > 3) {
          worstStatus = NOT_READY;
          worstPriority = 3;
        } else if (status.inSuccess.length > 0 && worstPriority > 4) {
          worstStatus = HEALTHY;
          worstPriority = 4;
        } else if (status.notAvailable.length > 0 && worstPriority > 5) {
          worstStatus = NA;
          worstPriority = 5;
        }
      }
    });

    return worstStatus;
  };

  // Count total unhealthy components (errors + warnings + not ready)
  const getUnhealthyCount = (): number => {
    let count = 0;
    [props.statusApp, props.statusService, props.statusWorkload].forEach(status => {
      if (status) {
        count += status.inError.length + status.inWarning.length + status.inNotReady.length;
      }
    });
    return count;
  };

  const worstStatus = getCombinedWorstStatus();

  const unhealthyCount = getUnhealthyCount();
  const isHealthy = worstStatus === HEALTHY;
  const isNA = worstStatus === NA;

  const getStatusText = (): string => {
    if (isNA) {
      return 'n/a';
    }
    return isHealthy ? t('Healthy') : t('Unhealthy');
  };

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: '0.125rem' }}>
        {worstStatus ? (
          <div className={classes(statusIconStyle, isNA ? namespaceNaIconStyle : '')}>{createIcon(worstStatus)}</div>
        ) : (
          <div style={{ display: 'inline-block', marginRight: '0.5rem', width: '1.5rem' }}></div>
        )}
        <div className={isNA ? naTextStyle : statusTextStyle}>{getStatusText()}</div>
      </div>
      {!isHealthy && !isNA && unhealthyCount > 0 && (
        <div style={{ marginLeft: '1.375rem', marginTop: '0.125rem' }}>{pluralize(unhealthyCount, 'issue')}</div>
      )}
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  duration: durationSelector(state),
  kiosk: state.globalState.kiosk,
  refreshInterval: refreshIntervalSelector(state)
});

export const NamespaceHealthStatus = connect(mapStateToProps)(NamespaceHealthStatusComponent);
