import * as React from 'react';
import { HEALTHY, NA } from '../../types/Health';
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
import { combinedWorstStatus } from 'utils/NamespaceHealthUtils';

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

  const worstStatus = combinedWorstStatus(props.statusApp, props.statusService, props.statusWorkload);

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
