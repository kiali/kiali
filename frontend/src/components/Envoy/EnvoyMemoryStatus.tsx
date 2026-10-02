import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import type { Workload } from 'types/Workload';
import type { EnvoyMemorySummary } from 'types/EnvoyMemory';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import { ColorScheme } from 'types/Common';
import { NA } from 'types/Health';
import { addError } from '../../utils/AlertUtils';
import { location } from '../../app/History';
import { createIcon, KialiIcon } from 'config/KialiIcon';
import { inlineIconRowStyle } from 'styles/FlexStyles';
import { infoStyle } from 'styles/IconStyle';
import { moreInfoLinkStyle } from 'components/Validations/WorkloadConfigValidation';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { useKialiColorScheme } from 'utils/AppearanceUtils';
import {
  buildEnvoyMemoryQueryParams,
  buildEnvoyMemoryTabUrl,
  envoyMemoryCauseLabel,
  envoyMemoryCauseStatus,
  fetchEnvoyMemorySummary,
  formatEnvoyMemoryBytes,
  formatEnvoyMemoryUsage,
  formatEnvoyRequestRate,
  hasEnvoyMemoryRunningPods,
  hasEnvoyMemoryWorkload,
  istioConfigurationScopingUrl
} from 'utils/EnvoyMemoryUtils';
import { t } from 'utils/I18nUtils';

type EnvoyMemoryStatusProps = {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  timeRange: TimeRange;
  workload: Workload;
};

export const EnvoyMemoryStatus: React.FC<EnvoyMemoryStatusProps> = (props: EnvoyMemoryStatusProps) => {
  const [summary, setSummary] = React.useState<EnvoyMemorySummary>();
  // Tooltip has reversed theme (light theme = dark background), so link colors are inverted
  const darkTheme = useKialiColorScheme() === ColorScheme.DARK;
  const linkColor = darkTheme ? PFColors.LinkTooltipDarkTheme : PFColors.LinkTooltipLightTheme;

  const fetchSummary = React.useCallback((): void => {
    fetchEnvoyMemorySummary(
      props.namespace,
      props.workload.name,
      buildEnvoyMemoryQueryParams(props.timeRange, props.lastRefreshAt),
      props.workload.cluster
    )
      .then(data => {
        setSummary(data);
      })
      .catch(error => {
        addError('Could not fetch Envoy memory summary.', error);
      });
  }, [props.lastRefreshAt, props.namespace, props.timeRange, props.workload.cluster, props.workload.name]);

  React.useEffect(() => {
    if (hasEnvoyMemoryWorkload(props.workload) && hasEnvoyMemoryRunningPods(props.workload)) {
      fetchSummary();
    }
  }, [fetchSummary, props.workload]);

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
  const showWarningLinks = summary.cause !== 'ok';
  const tooltipContent = (
    <div style={{ textAlign: 'left' }}>
      <div>
        <strong>{t('Status')}:</strong> {envoyMemoryCauseLabel(summary.cause)}
      </div>
      <div>
        <strong>{t('Allocated memory (max)')}:</strong> {formatEnvoyMemoryUsage(summary)}
      </div>
      {summary.memoryThresholdBytes > 0 && (
        <div>
          <strong>{t('Warning threshold')}:</strong> {formatEnvoyMemoryBytes(summary.memoryThresholdBytes)}
        </div>
      )}
      <div>
        <strong>{t('Traffic rate')}:</strong> {formatEnvoyRequestRate(summary)}
      </div>
      {showWarningLinks && (
        <div className={moreInfoLinkStyle} data-test="envoy-memory-status-scoping-link">
          <span>{t('More info at')}</span>
          <Link
            to={istioConfigurationScopingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: linkColor }}
          >
            {t('Learn about configuration scoping')}
          </Link>
        </div>
      )}
      <div className={moreInfoLinkStyle}>
        <span>{t('More info at')}</span>
        <Link to={buildEnvoyMemoryTabUrl(location.getPathname(), location.getSearch())} style={{ color: linkColor }}>
          {t('Envoy overview tab')}
        </Link>
      </div>
    </div>
  );

  return (
    <span className={inlineIconRowStyle} data-test="envoy-memory-status">
      {createIcon(status)}
      {status.name}
      <Tooltip content={tooltipContent} position={TooltipPosition.top}>
        <KialiIcon.Info className={infoStyle} />
      </Tooltip>
    </span>
  );
};
