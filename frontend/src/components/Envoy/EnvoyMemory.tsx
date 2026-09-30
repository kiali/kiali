import * as React from 'react';
import { Alert, Button, ButtonVariant, Card, CardBody, Popover, PopoverPosition } from '@patternfly/react-core';
import { EnvoyMemoryOverlayChart } from 'components/Envoy/EnvoyMemoryOverlayChart';
import type { Workload } from 'types/Workload';
import type { EnvoyConfigCounts, EnvoyMemorySummary } from 'types/EnvoyMemory';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { helpIconStyle } from 'styles/IconStyle';
import { PFFontWeight } from 'styles/PfTypography';
import { PFSpacer } from 'styles/PfSpacer';
import { PFColors } from 'components/Pf/PfColors';
import { tabCardStyle, flexCardStyle, noShrinkStyle } from 'styles/FlexStyles';
import { classes } from 'typestyle';
import {
  buildEnvoyMemoryQueryParams,
  envoyMemoryCauseLabel,
  envoyMemoryCauseStatus,
  envoyMemoryMetricHelp,
  envoyMemoryThresholdHelp,
  estimateEnvoyConfigMemoryBytes,
  fetchEnvoyMemorySummary,
  formatEnvoyMemoryBytes,
  formatEnvoyMemoryUsage,
  formatEnvoyRequestRate,
  istioConfigurationScopingUrl,
  sortedEnvoyPodName,
  type EnvoyMemoryMetricHelpKey
} from 'utils/EnvoyMemoryUtils';
import { t } from 'utils/I18nUtils';
import { createIcon, KialiIcon } from 'config/KialiIcon';

type EnvoyMemoryProps = {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  onSelectEnvoyTab?: (resource: string) => void;
  podName?: string;
  timeRange: TimeRange;
  workload: Workload;
};

const summaryStyle = kialiStyle({
  marginBottom: PFSpacer.md
});

const statusAlertStyle = kialiStyle({
  marginBottom: PFSpacer.md,
  $nest: {
    '& .pf-v6-c-alert__icon': {
      display: 'none'
    }
  }
});

const statusCauseStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  fontWeight: PFFontWeight.BodyBold,
  gap: PFSpacer.sm
});

const externalLinkIconStyle = kialiStyle({
  marginLeft: PFSpacer.sm,
  verticalAlign: 'middle'
});

const linkRowStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.md,
  marginBottom: PFSpacer.md
});

const tilesRowStyle = kialiStyle({
  alignItems: 'stretch',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.md
});

const tileStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  border: `1px solid ${PFColors.BorderColor100}`,
  borderRadius: 'var(--pf-t--global--border--radius--medium)',
  display: 'flex',
  flex: '1 1 8rem',
  flexDirection: 'column',
  gap: PFSpacer.xs,
  minHeight: '5.5rem',
  minWidth: '8rem',
  padding: `${PFSpacer.sm} ${PFSpacer.md}`
});

const tileLabelRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'nowrap',
  whiteSpace: 'nowrap'
});

const tileLabelStyle = kialiStyle({
  color: PFColors.Color200,
  fontSize: '0.875rem',
  fontWeight: PFFontWeight.BodyBold
});

const tileValueStyle = kialiStyle({
  flex: 1,
  fontSize: '1.25rem',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: PFFontWeight.BodyBold
});

const sectionStyle = kialiStyle({
  marginTop: PFSpacer.lg,
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden'
});

const maximizedSectionStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  maxWidth: '100%',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden'
});

const helpBodyStyle = kialiStyle({
  maxWidth: '22rem',
  textAlign: 'left'
});

const tileLinkStyle = kialiStyle({
  alignSelf: 'flex-start',
  flex: 1,
  fontSize: '1.25rem',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: PFFontWeight.BodyBold,
  padding: 0
});

const statusTitleStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  gap: PFSpacer.xs
});

const MetricHelpIcon: React.FC<{ helpKey: EnvoyMemoryMetricHelpKey; label: string }> = ({ helpKey, label }) => (
  <Popover
    aria-label={t('{{label}} information', { label })}
    bodyContent={<div className={helpBodyStyle}>{envoyMemoryMetricHelp(helpKey)}</div>}
    headerContent={<span>{label}</span>}
    position={PopoverPosition.top}
    triggerAction="hover"
  >
    <KialiIcon.Help className={helpIconStyle} />
  </Popover>
);

type MetricTileProps = {
  helpKey: EnvoyMemoryMetricHelpKey;
  label: string;
  onSelect?: () => void;
  selectTestId?: string;
  value: React.ReactNode;
};

const MetricTile: React.FC<MetricTileProps> = ({ helpKey, label, onSelect, selectTestId, value }) => (
  <div className={tileStyle}>
    <span className={tileLabelRowStyle}>
      <span className={tileLabelStyle}>{label}</span>
      <MetricHelpIcon helpKey={helpKey} label={label} />
    </span>
    {onSelect ? (
      <Button
        className={tileLinkStyle}
        data-test={selectTestId}
        isInline
        onClick={onSelect}
        variant={ButtonVariant.link}
      >
        {value}
      </Button>
    ) : (
      <span className={tileValueStyle}>{value}</span>
    )}
  </div>
);

export const EnvoyMemory: React.FC<EnvoyMemoryProps> = (props: EnvoyMemoryProps) => {
  const [summary, setSummary] = React.useState<EnvoyMemorySummary>();
  const [configCounts, setConfigCounts] = React.useState<{ counts: EnvoyConfigCounts; podName: string }>();
  const [isChartMaximized, setIsChartMaximized] = React.useState(false);
  const podName = props.podName || sortedEnvoyPodName(props.workload);
  const effectiveConfigCounts = podName && configCounts?.podName === podName ? configCounts.counts : undefined;

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
    fetchSummary();
  }, [fetchSummary]);

  React.useEffect(() => {
    if (!podName) {
      return;
    }

    let cancelled = false;

    Promise.all([
      API.getPodEnvoyProxyResourceEntries(props.namespace, podName, 'clusters', props.workload.cluster),
      API.getPodEnvoyProxyResourceEntries(props.namespace, podName, 'listeners', props.workload.cluster),
      API.getPodEnvoyProxyResourceEntries(props.namespace, podName, 'routes', props.workload.cluster)
    ])
      .then(([clusters, listeners, routes]) => {
        if (cancelled) {
          return;
        }

        setConfigCounts({
          podName,
          counts: {
            clusters: clusters.data.clusters?.length ?? 0,
            listeners: listeners.data.listeners?.length ?? 0,
            routes: routes.data.routes?.length ?? 0
          }
        });
      })
      .catch(() => {
        // Config dump counts are optional for the landing overview.
      });

    return () => {
      cancelled = true;
    };
  }, [podName, props.lastRefreshAt, props.namespace, props.workload.cluster]);

  const clusterCount = effectiveConfigCounts?.clusters ?? summary?.activeClustersMax;
  // Prefer config-dump cluster count so the estimate is not stuck at 0 when Prometheus lacks the metric.
  const roughConfigBytes =
    clusterCount !== undefined ? estimateEnvoyConfigMemoryBytes(clusterCount) : (summary?.roughConfigMemoryBytes ?? 0);
  const allocatedMemoryLabel = t('Allocated memory');
  const roughConfigLabel = t('Est. config memory');
  const activeClustersLabel = t('Active clusters');
  const listenersLabel = t('Listeners');
  const routesLabel = t('Routes');
  const activeConnectionsLabel = t('Active Connections');
  const requestRateLabel = t('Traffic rate');
  const memoryStatusLabel = t('Memory Status');

  return (
    <Card className={classes(flexCardStyle, tabCardStyle)} data-test="envoy-memory-tab">
      <CardBody>
        {!isChartMaximized && (
          <div className={classes(summaryStyle, noShrinkStyle)}>
            {summary && (
              <>
                <Alert
                  className={statusAlertStyle}
                  data-test="envoy-memory-status-alert"
                  isInline
                  title={
                    <span className={statusTitleStyle}>
                      {memoryStatusLabel}
                      <Popover
                        aria-label={t('{{label}} information', { label: memoryStatusLabel })}
                        bodyContent={<div className={helpBodyStyle}>{envoyMemoryThresholdHelp(summary)}</div>}
                        headerContent={<span>{memoryStatusLabel}</span>}
                        position={PopoverPosition.top}
                        triggerAction="hover"
                      >
                        <span data-test="envoy-memory-status-help">
                          <KialiIcon.Help className={helpIconStyle} />
                        </span>
                      </Popover>
                    </span>
                  }
                  variant={summary.cause === 'ok' ? 'success' : 'warning'}
                >
                  <div className={statusCauseStyle}>
                    {createIcon(envoyMemoryCauseStatus(summary.cause))}
                    {envoyMemoryCauseLabel(summary.cause)}
                  </div>
                </Alert>

                {summary.cause === 'configuration' && (
                  <div className={linkRowStyle}>
                    <Button
                      component="a"
                      href={istioConfigurationScopingUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant={ButtonVariant.link}
                      isInline
                      icon={<KialiIcon.ExternalLink className={externalLinkIconStyle} />}
                    >
                      {t('Learn about configuration scoping')}
                    </Button>
                  </div>
                )}

                <div className={tilesRowStyle} data-test="envoy-memory-summary-metrics">
                  <MetricTile
                    helpKey="roughConfigMemory"
                    label={roughConfigLabel}
                    value={formatEnvoyMemoryBytes(roughConfigBytes)}
                  />
                  <MetricTile
                    helpKey="activeClusters"
                    label={activeClustersLabel}
                    onSelect={props.onSelectEnvoyTab ? () => props.onSelectEnvoyTab!('clusters') : undefined}
                    selectTestId="envoy-overview-clusters-link"
                    value={clusterCount ?? 0}
                  />
                  {effectiveConfigCounts && (
                    <>
                      <MetricTile
                        helpKey="listeners"
                        label={listenersLabel}
                        onSelect={props.onSelectEnvoyTab ? () => props.onSelectEnvoyTab!('listeners') : undefined}
                        selectTestId="envoy-overview-listeners-link"
                        value={effectiveConfigCounts.listeners}
                      />
                      <MetricTile
                        helpKey="routes"
                        label={routesLabel}
                        onSelect={props.onSelectEnvoyTab ? () => props.onSelectEnvoyTab!('routes') : undefined}
                        selectTestId="envoy-overview-routes-link"
                        value={effectiveConfigCounts.routes}
                      />
                    </>
                  )}
                  <MetricTile
                    helpKey="allocatedMemory"
                    label={allocatedMemoryLabel}
                    value={formatEnvoyMemoryUsage(summary)}
                  />
                  <MetricTile
                    helpKey="activeConnections"
                    label={activeConnectionsLabel}
                    value={summary.activeConnections}
                  />
                  <MetricTile helpKey="requestRate" label={requestRateLabel} value={formatEnvoyRequestRate(summary)} />
                </div>
              </>
            )}
          </div>
        )}

        <div className={isChartMaximized ? maximizedSectionStyle : sectionStyle}>
          <EnvoyMemoryOverlayChart
            isMaximized={isChartMaximized}
            lastRefreshAt={props.lastRefreshAt}
            memoryLimitBytes={summary?.memoryLimitBytes}
            namespace={props.namespace}
            onToggleMaximized={() => setIsChartMaximized(prev => !prev)}
            timeRange={props.timeRange}
            workload={props.workload}
          />
        </div>
      </CardBody>
    </Card>
  );
};
