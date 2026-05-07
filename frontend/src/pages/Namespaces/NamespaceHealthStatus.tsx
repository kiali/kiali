import * as React from 'react';
import {
  DEGRADED,
  FAILURE,
  HEALTHY,
  HealthStatusId,
  NA,
  NOT_READY,
  Status,
  statusFromString
} from '../../types/Health';
import { NamespaceStatus } from '../../types/NamespaceInfo';
import { useKialiTranslation } from 'utils/I18nUtils';
import { createIcon } from '../../config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { durationSelector, refreshIntervalSelector } from '../../store/Selectors';
import { DurationInSeconds, IntervalInMilliseconds } from '../../types/Common';
import { pluralize, Popover, PopoverPosition } from '@patternfly/react-core';
import { namespaceNaIconStyle, statusIconStyle, statusTextStyle } from './NamespaceStyle';
import { naTextStyle } from 'styles/HealthStyle';
import { classes } from 'typestyle';
import { Paths } from 'config';
import { URLParam } from 'app/History';
import { camelCase } from 'lodash';
import { healthFilter } from 'components/Filters/CommonFilters';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { KialiLink } from 'components/Link/KialiLink';
import {
  linkStyle as overviewLinkStyle,
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
  /** When set, "N issues" appears on the same line as the status (e.g. namespace detail title). */
  inlineIssueCount?: boolean;
  name: string;
  statusApp?: NamespaceStatus;
  statusService?: NamespaceStatus;
  statusWorkload?: NamespaceStatus;
  worstStatus: string;
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
        count += (status.inError?.length ?? 0) + (status.inWarning?.length ?? 0) + (status.inNotReady?.length ?? 0);
      }
    });
    return count;
  };

  const worstStatus = statusFromString(props.worstStatus);

  const unhealthyCount = getUnhealthyCount();
  const isHealthy = worstStatus === HEALTHY;
  const isNA = worstStatus === NA;

  const getStatusText = (): string => {
    if (isNA) {
      return 'n/a';
    }
    return isHealthy ? t('Healthy') : worstStatus.name;
  };

  const buildListUrlForHealth = (targetPage: Paths, statusIds: HealthStatusId[]): string => {
    const params = new URLSearchParams();
    params.set(URLParam.NAMESPACES, props.name);
    statusIds.forEach(id => params.append(healthFilterParam, id));
    return `/${targetPage}?${params.toString()}`;
  };

  const statusCounts = (status?: NamespaceStatus | null): UnhealthyCounts => ({
    degraded: status?.inWarning?.length ?? 0,
    failure: status?.inError?.length ?? 0,
    notReady: status?.inNotReady?.length ?? 0
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
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>
        {items.map(c => (
          <span
            key={c.status.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            aria-label={`${c.status.name}: ${c.count}`}
          >
            <span style={{ display: 'inline-flex' }}>{createIcon(c.status)}</span>
            <span>{c.count}</span>
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
          <KialiLink to={url} onClick={() => FilterSelected.resetFilters()} className={classes(overviewLinkStyle)}>
            {`${label} (${total})`}
          </KialiLink>
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
  const inlineIconStyle: React.CSSProperties | undefined = props.inlineIssueCount
    ? { marginRight: 0, display: 'inline-flex', alignItems: 'center' }
    : undefined;
  const icon = (
    <span className={iconClassName} style={inlineIconStyle}>
      {createIcon(worstStatus)}
    </span>
  );
  const iconWithPopoverTrigger = (
    <span
      className={iconClassName}
      data-test="namespace-health-details-trigger"
      style={{ cursor: 'pointer', ...inlineIconStyle }}
      aria-label={t('Show unhealthy resources')}
    >
      {createIcon(worstStatus)}
    </span>
  );

  const issueCountText =
    !isHealthy && !isNA && unhealthyCount > 0 ? (
      <span
        style={{
          fontSize: 'var(--pf-t--global--font--size--sm)',
          color: 'var(--pf-t--global--text--color--subtle)',
          whiteSpace: 'nowrap'
        }}
      >
        {pluralize(unhealthyCount, 'issue')}
      </span>
    ) : null;

  const rowStyle: React.CSSProperties = props.inlineIssueCount
    ? {
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'nowrap',
        gap: '0.25rem',
        marginBottom: 0,
        textAlign: 'left'
      }
    : {
        marginBottom: '0.125rem',
        textAlign: 'left'
      };

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={rowStyle}>
        {worstStatus ? (
          !isHealthy && !isNA && hasIssueDetails ? (
            <Popover
              aria-label={t('Namespace health details')}
              position={PopoverPosition.right}
              triggerAction="click"
              showClose={true}
              headerContent={
                <span className={popoverHeaderStyle}>
                  {createIcon(worstStatus)} {worstStatus.name}
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
        {props.inlineIssueCount && issueCountText}
      </div>
      {!props.inlineIssueCount && !isHealthy && !isNA && unhealthyCount > 0 && (
        <div
          style={{
            marginLeft: '1.375rem',
            marginTop: '0.125rem',
            fontSize: 'var(--pf-t--global--font--size--sm)',
            color: 'var(--pf-t--global--text--color--subtle)'
          }}
        >
          {pluralize(unhealthyCount, 'issue')}
        </div>
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
