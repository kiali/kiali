import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import type { Workload } from 'types/Workload';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import { ColorScheme } from 'types/Common';
import { NA } from 'types/Health';
import { location } from '../../app/History';
import { createIcon, KialiIcon } from 'config/KialiIcon';
import { inlineIconRowStyle } from 'styles/FlexStyles';
import { infoStyle } from 'styles/IconStyle';
import { moreInfoLinkStyle } from 'components/Validations/WorkloadConfigValidation';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { useKialiColorScheme } from 'utils/AppearanceUtils';
import { useEnvoyMemorySummary } from 'hooks/useEnvoyMemorySummary';
import {
  buildEnvoyMemoryTabUrl,
  envoyMemoryCauseLabel,
  envoyMemoryCauseStatus,
  formatEnvoyMemoryBytes,
  formatEnvoyRequestRate,
  hasEnvoyMemoryRunningPods,
  hasEnvoyMemoryWorkload,
  shouldShowEnvoyMemoryStatus
} from 'utils/EnvoyMemoryUtils';
import { t } from 'utils/I18nUtils';

type EnvoyMemoryStatusProps = {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  timeRange: TimeRange;
  workload: Workload;
};

export const EnvoyMemoryStatus: React.FC<EnvoyMemoryStatusProps> = (props: EnvoyMemoryStatusProps) => {
  const fetchEnabled = shouldShowEnvoyMemoryStatus(props.workload);
  const { summary } = useEnvoyMemorySummary(
    props.namespace,
    props.workload,
    props.timeRange,
    props.lastRefreshAt,
    fetchEnabled
  );
  // Tooltip has reversed theme (light theme = dark background), so link colors are inverted
  const darkTheme = useKialiColorScheme() === ColorScheme.DARK;
  const linkColor = darkTheme ? PFColors.LinkTooltipDarkTheme : PFColors.LinkTooltipLightTheme;

  if (!hasEnvoyMemoryWorkload(props.workload)) {
    return null;
  }

  if (!hasEnvoyMemoryRunningPods(props.workload)) {
    return (
      <span className={inlineIconRowStyle} data-test="envoy-memory-status">
        {createIcon(NA)}
        {NA.name}
      </span>
    );
  }

  if (!fetchEnabled) {
    return null;
  }

  if (!summary) {
    const loadingStatus = NA;
    return (
      <span className={inlineIconRowStyle}>
        {createIcon(loadingStatus)}
        {loadingStatus.name}
      </span>
    );
  }

  const status = envoyMemoryCauseStatus(summary.cause);
  const memoryLimitBytes = summary.memoryLimitBytes;
  const percentOfLimit =
    memoryLimitBytes > 0
      ? Number.isFinite(summary.memoryUsedPercent) && summary.memoryUsedPercent > 0
        ? summary.memoryUsedPercent
        : (summary.memoryMaxBytes / memoryLimitBytes) * 100
      : undefined;
  const tooltipContent = (
    <div style={{ textAlign: 'left' }}>
      <div>
        <strong>{t('Status')}:</strong> {envoyMemoryCauseLabel(summary.cause)}
      </div>
      <div>
        <strong>{t('Allocated memory (max)')}:</strong> {formatEnvoyMemoryBytes(summary.memoryMaxBytes)}
      </div>
      {memoryLimitBytes > 0 && percentOfLimit !== undefined && (
        <div>
          <strong>{t('Memory limit')}:</strong>{' '}
          {t('{{limit}} ({{percent}}% of limit)', {
            limit: formatEnvoyMemoryBytes(memoryLimitBytes),
            percent: percentOfLimit.toFixed(1)
          })}
        </div>
      )}
      {summary.memoryThresholdBytes > 0 && (
        <div>
          <strong>{t('Warning threshold')}:</strong> {formatEnvoyMemoryBytes(summary.memoryThresholdBytes)}
        </div>
      )}
      <div>
        <strong>{t('Traffic rate')}:</strong> {formatEnvoyRequestRate(summary)}
      </div>
      <div className={moreInfoLinkStyle}>
        <span>{t('More info at')}</span>
        <Link to={buildEnvoyMemoryTabUrl(location.getPathname(), location.getSearch())} style={{ color: linkColor }}>
          {t('Envoy overview tab')}
        </Link>
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position={TooltipPosition.top}>
      <span className={inlineIconRowStyle} data-test="envoy-memory-status">
        {createIcon(status)}
        {status.name}
        <KialiIcon.Info className={infoStyle} />
      </span>
    </Tooltip>
  );
};
