import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Card,
  CardBody,
  Popover,
  PopoverPosition,
  Title,
  TitleSizes,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { EnvoyMemoryOverlayChart } from 'components/Envoy/EnvoyMemoryOverlayChart';
import type { Workload } from 'types/Workload';
import type { EnvoyConfigCounts, EnvoyMemorySummary } from 'types/EnvoyMemory';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { helpIconStyle } from 'styles/IconStyle';
import { PFFontWeight } from 'styles/PfTypography';
import { PFColors } from 'components/Pf/PfColors';
import { inlineIconRowStyle, tabCardStyle, flexCardStyle } from 'styles/FlexStyles';
import { classes } from 'typestyle';
import {
  buildEnvoyMemoryQueryParams,
  envoyMemoryCauseDescription,
  envoyMemoryCauseLabel,
  envoyMemoryCauseStatus,
  envoyMemoryMetricHelp,
  formatEnvoyMemoryBytes,
  formatEnvoyMemoryUsage,
  formatEnvoyRequestRate,
  istioConfigurationScopingUrl,
  type EnvoyMemoryMetricHelpKey
} from 'utils/EnvoyMemoryUtils';
import { t } from 'utils/I18nUtils';
import { createIcon, KialiIcon } from 'config/KialiIcon';

type EnvoyMemoryProps = {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  onSelectEnvoyTab?: (resource: string) => void;
  timeRange: TimeRange;
  workload: Workload;
};

const summaryStyle = kialiStyle({
  marginBottom: '0.75rem'
});

const titleRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  flexWrap: 'nowrap',
  gap: '0.25rem'
});

const statusTooltipStyle = kialiStyle({
  textAlign: 'left'
});

const externalLinkIconStyle = kialiStyle({
  marginLeft: '0.5rem',
  verticalAlign: 'middle'
});

const linkRowStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  marginTop: '1rem'
});

const tilesStyle = kialiStyle({
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))',
  marginTop: '1rem'
});

const tileStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100,
  border: `1px solid ${PFColors.BorderColor100}`,
  borderRadius: '0.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  minWidth: '11rem',
  padding: '0.75rem 1rem'
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
  fontSize: '1.25rem',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: PFFontWeight.BodyBold
});

const tileHintStyle = kialiStyle({
  color: PFColors.Color200,
  fontSize: '0.75rem'
});

const sectionStyle = kialiStyle({
  marginTop: '2.5rem'
});

const helpBodyStyle = kialiStyle({
  maxWidth: '22rem',
  textAlign: 'left'
});

const tileLinkStyle = kialiStyle({
  fontSize: '1.25rem',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: PFFontWeight.BodyBold,
  padding: 0
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

const sortedPodName = (workload: Workload): string | undefined => {
  const pods = [...(workload.pods ?? [])].sort((a, b) => (a.name >= b.name ? 1 : -1));
  return pods[0]?.name;
};

export const EnvoyMemory: React.FC<EnvoyMemoryProps> = (props: EnvoyMemoryProps) => {
  const [summary, setSummary] = React.useState<EnvoyMemorySummary>();
  const [configCounts, setConfigCounts] = React.useState<{ counts: EnvoyConfigCounts; podName: string }>();
  const podName = sortedPodName(props.workload);
  const effectiveConfigCounts = podName && configCounts?.podName === podName ? configCounts.counts : undefined;

  const fetchSummary = React.useCallback((): void => {
    API.getWorkloadEnvoyMemory(
      props.namespace,
      props.workload.name,
      buildEnvoyMemoryQueryParams(props.timeRange, props.lastRefreshAt),
      props.workload.cluster
    )
      .then(response => {
        setSummary(response.data);
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
        // Config dump counts are optional for the landing summary.
      });

    return () => {
      cancelled = true;
    };
  }, [podName, props.lastRefreshAt, props.namespace, props.workload.cluster]);

  const overviewHelpBody = (
    <div className={helpBodyStyle}>
      <p>
        {t(
          'This overview summarizes Envoy proxy config size and memory. High memory with little traffic and many clusters may indicate wasteful configuration that Sidecar scoping can reduce.'
        )}
      </p>
      <Button
        component="a"
        href={istioConfigurationScopingUrl()}
        target="_blank"
        rel="noopener noreferrer"
        variant={ButtonVariant.link}
        isInline
        icon={<KialiIcon.ExternalLink className={externalLinkIconStyle} />}
      >
        {t('Istio configuration scoping')}
      </Button>
    </div>
  );

  const clusterCount = effectiveConfigCounts?.clusters ?? summary?.activeClustersMax;
  const roughConfigBytes = summary?.roughConfigMemoryBytes;
  const memoryStatusLabel = t('Memory status');
  const allocatedMemoryLabel = t('Allocated memory');
  const roughConfigLabel = t('Est. config memory');
  const activeClustersLabel = t('Active clusters');
  const listenersLabel = t('Listeners');
  const routesLabel = t('Routes');
  const activeConnectionsLabel = t('Active connections');
  const requestRateLabel = t('Request rate');

  const memoryStatusTooltip = summary ? (
    <div className={statusTooltipStyle}>
      <div>
        <strong>{memoryStatusLabel}:</strong> {envoyMemoryCauseLabel(summary.cause)}
      </div>
      <div>{envoyMemoryCauseDescription(summary.cause)}</div>
      <div style={{ marginTop: '0.5rem' }}>{envoyMemoryMetricHelp('memoryStatus')}</div>
    </div>
  ) : null;

  return (
    <Card className={classes(flexCardStyle, tabCardStyle)} data-test="envoy-memory-tab">
      <CardBody>
        <div className={summaryStyle}>
          <Title headingLevel="h3" size={TitleSizes.md}>
            <span className={titleRowStyle}>
              {t('Envoy overview')}
              {summary && (
                <Tooltip content={memoryStatusTooltip} position={TooltipPosition.right}>
                  <span className={inlineIconRowStyle} data-test="envoy-memory-status-icon">
                    {createIcon(envoyMemoryCauseStatus(summary.cause))}
                  </span>
                </Tooltip>
              )}
              <Popover
                aria-label={t('Envoy overview information')}
                bodyContent={overviewHelpBody}
                headerContent={<span>{t('Envoy overview')}</span>}
                position={PopoverPosition.top}
                triggerAction="hover"
              >
                <KialiIcon.Help className={helpIconStyle} />
              </Popover>
            </span>
          </Title>

          {summary && (
            <>
              <div className={tilesStyle} data-test="envoy-memory-summary-metrics">
                <div className={tileStyle}>
                  <span className={tileLabelRowStyle}>
                    <span className={tileLabelStyle}>{allocatedMemoryLabel}</span>
                    <MetricHelpIcon helpKey="allocatedMemory" label={allocatedMemoryLabel} />
                  </span>
                  <span className={tileValueStyle}>{formatEnvoyMemoryUsage(summary)}</span>
                  {summary.memoryThresholdBytes > 0 && (
                    <span className={tileHintStyle}>
                      {t('Warning at {{threshold}}', {
                        threshold: formatEnvoyMemoryBytes(summary.memoryThresholdBytes)
                      })}
                    </span>
                  )}
                </div>

                <div className={tileStyle}>
                  <span className={tileLabelRowStyle}>
                    <span className={tileLabelStyle}>{roughConfigLabel}</span>
                    <MetricHelpIcon helpKey="roughConfigMemory" label={roughConfigLabel} />
                  </span>
                  <span className={tileValueStyle}>{formatEnvoyMemoryBytes(roughConfigBytes ?? 0)}</span>
                  <span className={tileHintStyle}>{t('Rough estimate from cluster count')}</span>
                </div>

                <div className={tileStyle}>
                  <span className={tileLabelRowStyle}>
                    <span className={tileLabelStyle}>{activeClustersLabel}</span>
                    <MetricHelpIcon helpKey="activeClusters" label={activeClustersLabel} />
                  </span>
                  {props.onSelectEnvoyTab ? (
                    <Button
                      className={tileLinkStyle}
                      data-test="envoy-overview-clusters-link"
                      isInline
                      onClick={() => props.onSelectEnvoyTab!('clusters')}
                      variant={ButtonVariant.link}
                    >
                      {clusterCount ?? 0}
                    </Button>
                  ) : (
                    <span className={tileValueStyle}>{clusterCount ?? 0}</span>
                  )}
                  {summary.largeConfigClustersThreshold > 0 && (
                    <span className={tileHintStyle}>
                      {t('Large config above {{threshold}}', {
                        threshold: summary.largeConfigClustersThreshold
                      })}
                    </span>
                  )}
                </div>

                {effectiveConfigCounts && (
                  <>
                    <div className={tileStyle}>
                      <span className={tileLabelRowStyle}>
                        <span className={tileLabelStyle}>{listenersLabel}</span>
                        <MetricHelpIcon helpKey="listeners" label={listenersLabel} />
                      </span>
                      {props.onSelectEnvoyTab ? (
                        <Button
                          className={tileLinkStyle}
                          data-test="envoy-overview-listeners-link"
                          isInline
                          onClick={() => props.onSelectEnvoyTab!('listeners')}
                          variant={ButtonVariant.link}
                        >
                          {effectiveConfigCounts.listeners}
                        </Button>
                      ) : (
                        <span className={tileValueStyle}>{effectiveConfigCounts.listeners}</span>
                      )}
                    </div>
                    <div className={tileStyle}>
                      <span className={tileLabelRowStyle}>
                        <span className={tileLabelStyle}>{routesLabel}</span>
                        <MetricHelpIcon helpKey="routes" label={routesLabel} />
                      </span>
                      {props.onSelectEnvoyTab ? (
                        <Button
                          className={tileLinkStyle}
                          data-test="envoy-overview-routes-link"
                          isInline
                          onClick={() => props.onSelectEnvoyTab!('routes')}
                          variant={ButtonVariant.link}
                        >
                          {effectiveConfigCounts.routes}
                        </Button>
                      ) : (
                        <span className={tileValueStyle}>{effectiveConfigCounts.routes}</span>
                      )}
                    </div>
                  </>
                )}

                <div className={tileStyle}>
                  <span className={tileLabelRowStyle}>
                    <span className={tileLabelStyle}>{activeConnectionsLabel}</span>
                    <MetricHelpIcon helpKey="activeConnections" label={activeConnectionsLabel} />
                  </span>
                  <span className={tileValueStyle}>{summary.activeConnections}</span>
                </div>

                <div className={tileStyle}>
                  <span className={tileLabelRowStyle}>
                    <span className={tileLabelStyle}>{requestRateLabel}</span>
                    <MetricHelpIcon helpKey="requestRate" label={requestRateLabel} />
                  </span>
                  <span className={tileValueStyle}>{formatEnvoyRequestRate(summary)}</span>
                </div>
              </div>

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
            </>
          )}
        </div>

        <div className={sectionStyle}>
          <EnvoyMemoryOverlayChart
            lastRefreshAt={props.lastRefreshAt}
            namespace={props.namespace}
            timeRange={props.timeRange}
            workload={props.workload}
          />
        </div>
      </CardBody>
    </Card>
  );
};
