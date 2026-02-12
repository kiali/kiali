import * as React from 'react';
import { DEGRADED, FAILURE, HEALTHY, HealthStatusId, NA, NOT_READY, Status } from '../../types/Health';
import { NamespaceStatus } from '../../types/NamespaceInfo';
import { useKialiTranslation } from 'utils/I18nUtils';
import { createIcon } from '../../config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { DurationInSeconds, IntervalInMilliseconds } from '../../types/Common';
import { Button, pluralize, Popover, PopoverPosition } from '@patternfly/react-core';
import { namespaceNaIconStyle, statusIconStyle, statusTextStyle } from './NamespaceStyle';
import { naTextStyle } from 'styles/HealthStyle';
import { classes } from 'typestyle';
import { combinedWorstStatus } from 'utils/NamespaceUtils';
import { Paths } from 'config';
import { URLParam } from 'app/History';
import { camelCase } from 'lodash';
import { healthFilter } from 'components/Filters/CommonFilters';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { kialiNavigate } from 'utils/NavigationUtils';
import {
  linkStyle as overviewLinkStyle,
  noUnderlineStyle,
  popoverHeaderStyle,
  popoverItemStatusStyle,
  popoverItemStyle
} from 'pages/Overview/OverviewStyles';

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

type UnhealthyCounts = {
  degraded: number;
  failure: number;
  notReady: number;
};

const NamespaceHealthStatusComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const healthFilterParam = camelCase(healthFilter.category);

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

  const buildListUrlForHealth = (targetPage: Paths, statusIds: HealthStatusId[]): string => {
    const params = new URLSearchParams();
    params.set(URLParam.NAMESPACES, props.name);
    statusIds.forEach(id => params.append(healthFilterParam, id));
    return `/${targetPage}?${params.toString()}`;
  };

  const navigateToUrl = (url: string): void => {
    FilterSelected.resetFilters();
    kialiNavigate(url);
  };

  const statusCounts = (status?: NamespaceStatus): UnhealthyCounts => ({
    degraded: status?.inWarning.length ?? 0,
    failure: status?.inError.length ?? 0,
    notReady: status?.inNotReady.length ?? 0
  });

  const appCounts = statusCounts(props.statusApp);
  const serviceCounts = statusCounts(props.statusService);
  const workloadCounts = statusCounts(props.statusWorkload);

  const unhealthyHealthIds: HealthStatusId[] = [
    FAILURE.id as HealthStatusId,
    DEGRADED.id as HealthStatusId,
    NOT_READY.id as HealthStatusId
  ];

  const renderResourceHealthSummary = (counts: UnhealthyCounts): React.ReactNode => {
    const cols: Array<{ count: number; status: Status }> = [
      { count: counts.failure, status: FAILURE },
      { count: counts.degraded, status: DEGRADED },
      { count: counts.notReady, status: NOT_READY }
    ];

    const items = cols.filter(c => c.count > 0);
    if (items.length === 0) {
      return null;
    }

    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
        {items.map(c => (
          <span
            key={c.status.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              justifyContent: 'flex-end'
            }}
            aria-label={`${c.status.name}: ${c.count}`}
          >
            <span style={{ width: '1.25rem', display: 'inline-flex', justifyContent: 'center' }}>
              {createIcon(c.status)}
            </span>
            <span style={{ minWidth: '2ch', textAlign: 'right' }}>{c.count}</span>
          </span>
        ))}
      </span>
    );
  };

  const renderResourceRow = (targetPage: Paths, label: string, counts: UnhealthyCounts): React.ReactNode => {
    const total = counts.failure + counts.degraded + counts.notReady;
    if (total === 0) {
      return null;
    }

    const url = buildListUrlForHealth(targetPage, unhealthyHealthIds);

    return (
      <div className={popoverItemStyle}>
        <span>
          <Button
            variant="link"
            isInline
            className={classes(overviewLinkStyle, noUnderlineStyle)}
            onClick={() => navigateToUrl(url)}
          >
            {`${label} (${total})`}
          </Button>
        </span>
        <span className={popoverItemStatusStyle}>{renderResourceHealthSummary(counts)}</span>
      </div>
    );
  };

  const hasIssueDetails =
    (appCounts.failure + appCounts.degraded + appCounts.notReady ||
      serviceCounts.failure + serviceCounts.degraded + serviceCounts.notReady ||
      workloadCounts.failure + workloadCounts.degraded + workloadCounts.notReady) > 0;

  const iconClassName = classes(statusIconStyle, isNA ? namespaceNaIconStyle : '');
  const icon = <span className={iconClassName}>{createIcon(worstStatus)}</span>;
  const iconWithPopoverTrigger = (
    <span
      className={iconClassName}
      data-test="namespace-health-details-trigger"
      style={{ cursor: 'pointer' }}
      aria-label={t('Show unhealthy resources')}
    >
      {createIcon(worstStatus)}
    </span>
  );

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: '0.125rem' }}>
        {worstStatus ? (
          !isHealthy && !isNA && hasIssueDetails ? (
            <Popover
              aria-label={t('Namespace health details')}
              position={PopoverPosition.right}
              triggerAction="click"
              showClose={true}
              headerContent={
                <span className={popoverHeaderStyle}>
                  {createIcon(worstStatus)} {t('Unhealthy')}
                </span>
              }
              bodyContent={
                <div style={{ minWidth: '16rem' }}>
                  {renderResourceRow(Paths.WORKLOADS, t('Workloads'), workloadCounts)}
                  {renderResourceRow(Paths.APPLICATIONS, t('Applications'), appCounts)}
                  {renderResourceRow(Paths.SERVICES, t('Services'), serviceCounts)}
                </div>
              }
            >
              {iconWithPopoverTrigger}
            </Popover>
          ) : (
            icon
          )
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
