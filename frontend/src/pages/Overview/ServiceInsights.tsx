import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Form,
  FormGroup,
  Popover,
  PopoverPosition,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import type { TOptions } from 'i18next';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { CogIcon, LongArrowAltDownIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiLink } from 'components/Link/KialiLink';
import { PFColors } from 'components/Pf/PfColors';
import { createIcon, KialiIcon } from 'config/KialiIcon';
import { isMultiCluster, Paths } from 'config';
import { cardStyle, cardBodyStyle, iconStyle } from './OverviewStyles';
import { useKialiTranslation } from 'utils/I18nUtils';
import * as API from 'services/Api';
import { statusFromString } from 'types/Health';
import { ServiceLatency, ServiceRequests, ServiceThroughput } from 'types/Overview';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { useRefreshInterval } from 'hooks/refresh';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import { activeNamespacesSelector, namespaceItemsSelector } from 'store/Selectors';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { HistoryManager, URLParam } from 'app/History';
import { helpIconStyle } from 'styles/IconStyle';
import { formatByteRateIEC } from 'utils/Formatter';
import { UserSettingsActions } from 'actions/UserSettingsActions';

type ServiceInsightsMetricsSelection = { errorRates: boolean; latency: boolean; tcp: boolean };

const encodeServiceInsightsMetrics = (m: ServiceInsightsMetricsSelection): string => {
  const parts: string[] = [];
  if (m.errorRates) {
    parts.push('e');
  }
  if (m.latency) {
    parts.push('l');
  }
  if (m.tcp) {
    parts.push('t');
  }
  return parts.join(',');
};

const decodeServiceInsightsMetrics = (raw: string | undefined): ServiceInsightsMetricsSelection | undefined => {
  if (!raw) {
    return undefined;
  }
  const tokens = new Set(
    raw
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
  );
  const decoded = {
    errorRates: tokens.has('e'),
    latency: tokens.has('l'),
    tcp: tokens.has('t')
  };
  // Require at least one metric, otherwise treat as absent/invalid.
  return decoded.errorRates || decoded.latency || decoded.tcp ? decoded : undefined;
};

// Min width per table column so horizontal scroll appears before tables overlap (padding/gap preserved).
const SERVICE_INSIGHTS_TABLE_MIN_WIDTH_PX = 220;

const tablesContainerMultiColStyle = kialiStyle({
  alignItems: 'start',
  display: 'grid',
  gap: '2.5rem',
  minWidth: 0, // Allow shrinking so overflow triggers scroll instead of overlap
  overflowX: 'auto'
});

const tablesContainer1ColStyle = kialiStyle({
  alignItems: 'start',
  display: 'grid',
  gap: '2.5rem',
  gridTemplateColumns: 'minmax(0, 1fr)'
});

const cardHeaderTitleLayoutStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'space-between',
  width: '100%'
});

const cardHeaderTitleLeftStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  gap: '0.5rem',
  minWidth: 0
});

const cardHeaderTitleActionsStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  gap: '0.25rem'
});

const tableContainerStyle = kialiStyle({
  minWidth: 0
});

const tableStyle = kialiStyle({
  borderCollapse: 'collapse',
  tableLayout: 'fixed', // Enforces column widths so Name cell can truncate with ellipsis
  width: '100%'
});

const tableHeaderStyle = kialiStyle({
  borderBottom: 'none',
  color: 'var(--pf-t--global--text--color--primary--default)',
  fontSize: '0.875rem',
  padding: '0.75rem 0.5rem',
  textAlign: 'left'
});

const tableRowStyle = kialiStyle({
  borderBottom: `1px solid ${PFColors.BorderColor100}`,
  $nest: {
    '&:hover': {
      backgroundColor: PFColors.BackgroundColor200
    }
  }
});

const tableCellStyle = kialiStyle({
  fontSize: '0.875rem',
  padding: '0.75rem 0.5rem'
});

const rateCellStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  fontSize: '0.875rem',
  gap: '0.25rem',
  justifyContent: 'flex-start',
  padding: '0.75rem 0.5rem',
  whiteSpace: 'nowrap'
});

const statusIconStyle = kialiStyle({
  height: '1rem',
  width: '1rem'
});

const serviceLinkStyle = kialiStyle({
  color: PFColors.Link,
  display: 'inline-block',
  maxWidth: '100%',
  overflow: 'hidden',
  textDecoration: 'underline !important',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  $nest: {
    '&, &:hover, &:focus, &:active': {
      textDecoration: 'underline !important'
    }
  }
});

const emptyStateStyle = kialiStyle({
  alignItems: 'center',
  color: PFColors.Color200,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  justifyContent: 'center'
});

const sortIconDisabledStyle = kialiStyle({
  // "Disabled" sort indicator: visible but not interactive.
  color: 'var(--pf-t--global--icon--color--regular)',
  fontSize: '0.75rem',
  marginLeft: '0.5rem',
  opacity: 1
});

const formatLatency = (latencyMs: number): string => {
  if (latencyMs >= 1000) {
    return `${(latencyMs / 1000).toFixed(2)}s`;
  }
  return `${latencyMs.toFixed(2)}ms`;
};

const formatErrorRate = (rate: number): string => {
  return `${(rate * 100).toFixed(2)}%`;
};

const formatRequestRate = (t: (key: string, opts?: TOptions) => string, reqPerSec: number): string => {
  if (reqPerSec >= 1000) {
    return t('{{rate}}k req/s', { rate: (reqPerSec / 1000).toFixed(2) });
  }
  return t('{{rate}} req/s', { rate: reqPerSec.toFixed(2) });
};

const formatByteRate = (bytesPerSec: number): string => formatByteRateIEC(bytesPerSec, 2);

const buildTooltipContent = (cluster: string, namespace: string, serviceName: string): React.ReactNode => {
  return (
    <div style={{ textAlign: 'left' }}>
      <div>
        <PFBadge badge={PFBadges.Cluster} size="sm" />
        {cluster}
      </div>
      <div>
        <PFBadge badge={PFBadges.Namespace} size="sm" />
        {namespace}
      </div>
      <div>{serviceName}</div>
    </div>
  );
};

export const ServiceInsights: React.FC = () => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const dispatch = useKialiDispatch();
  const namespaceItems = useKialiSelector(namespaceItemsSelector);
  const activeNamespaces = useKialiSelector(activeNamespacesSelector);
  const persistedMetricsRaw = useKialiSelector(state => state.userSettings.interface.serviceInsightsMetrics);

  // Use all known namespaces when available
  const effectiveNamespaces = React.useMemo(() => {
    return namespaceItems && namespaceItems.length > 0 ? namespaceItems : activeNamespaces;
  }, [activeNamespaces, namespaceItems]);

  const allNamespaceNames = React.useMemo(() => {
    return Array.from(new Set(effectiveNamespaces.map(ns => ns.name))).sort();
  }, [effectiveNamespaces]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [latencies, setLatencies] = React.useState<ServiceLatency[]>([]);
  const [rates, setRates] = React.useState<ServiceRequests[]>([]);
  const [throughput, setThroughput] = React.useState<ServiceThroughput[]>([]);
  const [latenciesError, setLatenciesError] = React.useState(false);
  const [ratesError, setRatesError] = React.useState(false);
  const [throughputError, setThroughputError] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  const urlMetricsRaw = HistoryManager.getParam(URLParam.SERVICE_INSIGHTS_METRICS);
  const urlMetrics = decodeServiceInsightsMetrics(urlMetricsRaw);
  const reduxMetrics = decodeServiceInsightsMetrics(persistedMetricsRaw);
  const initialMetricsRaw =
    urlMetricsRaw && urlMetrics ? urlMetricsRaw : persistedMetricsRaw && reduxMetrics ? persistedMetricsRaw : undefined;

  // When there's no URL preference, columns are set from data after load (effect below)
  const hasUrlPreference = !!(urlMetricsRaw && urlMetrics);
  const [isManageColumnsOpen, setIsManageColumnsOpen] = React.useState(false);
  const [selectedMetrics, setSelectedMetrics] = React.useState<ServiceInsightsMetricsSelection>(() => {
    if (hasUrlPreference) {
      return urlMetrics!;
    }
    if (reduxMetrics) {
      return reduxMetrics;
    }
    return { errorRates: false, latency: false, tcp: false };
  });
  const [draftMetrics, setDraftMetrics] = React.useState<ServiceInsightsMetricsSelection>(() => {
    if (hasUrlPreference) {
      return urlMetrics!;
    }
    if (reduxMetrics) {
      return reduxMetrics;
    }
    return { errorRates: false, latency: false, tcp: false };
  });

  // If URL has the metrics param, persist it to redux. We do not push redux to URL when URL is empty
  // so that "no URL preference" keeps using data-based default columns.
  React.useEffect(() => {
    const fromUrlRaw = HistoryManager.getParam(URLParam.SERVICE_INSIGHTS_METRICS);
    const fromUrl = decodeServiceInsightsMetrics(fromUrlRaw);

    if (fromUrlRaw && fromUrl && fromUrlRaw !== persistedMetricsRaw) {
      dispatch(UserSettingsActions.setServiceInsightsMetrics(fromUrlRaw));
    }
  }, [dispatch, persistedMetricsRaw]);

  React.useEffect(() => {
    if (initialMetricsRaw && initialMetricsRaw !== persistedMetricsRaw) {
      dispatch(UserSettingsActions.setServiceInsightsMetrics(initialMetricsRaw));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When there's no URL or Redux preference, show by default only the columns that have data
  React.useEffect(() => {
    if (isLoading) {
      return;
    }
    const urlRaw = HistoryManager.getParam(URLParam.SERVICE_INSIGHTS_METRICS);
    if (urlRaw && decodeServiceInsightsMetrics(urlRaw)) {
      return;
    }
    if (persistedMetricsRaw && decodeServiceInsightsMetrics(persistedMetricsRaw)) {
      return;
    }
    setSelectedMetrics({
      errorRates: true,
      latency: true,
      tcp: throughput.length > 0
    });
  }, [isLoading, rates.length, latencies.length, throughput.length, persistedMetricsRaw]);

  const buildServicesListUrl = React.useCallback((): string => {
    const params = new URLSearchParams();
    if (allNamespaceNames.length > 0) {
      params.set(URLParam.NAMESPACES, allNamespaceNames.join(','));
    }
    params.set(URLParam.DIRECTION, 'asc');
    params.set(URLParam.SORT, 'he');
    params.set(URLParam.SERVICE_INSIGHTS_METRICS, encodeServiceInsightsMetrics(selectedMetrics));

    const qs = params.toString();
    return `/${Paths.SERVICES}${qs ? `?${qs}` : ''}`;
  }, [allNamespaceNames, selectedMetrics]);

  const onOpenManageColumns = React.useCallback((): void => {
    setDraftMetrics(selectedMetrics);
    setIsManageColumnsOpen(true);
  }, [selectedMetrics]);

  const onCancelManageColumns = React.useCallback((): void => {
    setIsManageColumnsOpen(false);
  }, []);

  const onSaveManageColumns = React.useCallback((): void => {
    setSelectedMetrics(draftMetrics);
    setIsManageColumnsOpen(false);
    const encoded = encodeServiceInsightsMetrics(draftMetrics);
    dispatch(UserSettingsActions.setServiceInsightsMetrics(encoded));
    HistoryManager.setParam(URLParam.SERVICE_INSIGHTS_METRICS, encoded);
  }, [dispatch, draftMetrics]);

  const fetchData = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setIsError(false);
      setLatenciesError(false);
      setRatesError(false);
      setThroughputError(false);

      const [latenciesResult, ratesResult, throughputResult] = await Promise.allSettled([
        API.getOverviewServiceLatencies(),
        API.getOverviewServiceRates(),
        API.getOverviewServiceThroughput()
      ]);

      let anySuccess = false;

      if (latenciesResult.status === 'fulfilled') {
        setLatencies(latenciesResult.value.data.services || []);
        anySuccess = true;
      } else {
        setLatencies([]);
        setLatenciesError(true);
      }

      if (ratesResult.status === 'fulfilled') {
        setRates(ratesResult.value.data.services || []);
        anySuccess = true;
      } else {
        setRates([]);
        setRatesError(true);
      }

      if (throughputResult.status === 'fulfilled') {
        setThroughput(throughputResult.value.data.services || []);
        anySuccess = true;
      } else {
        setThroughput([]);
        setThroughputError(true);
      }

      if (!anySuccess) {
        setIsError(true);
      }
    } catch (err) {
      setIsError(true);
      setLatenciesError(true);
      setRatesError(true);
      setThroughputError(true);
      // eslint-disable-next-line no-console
      console.error('Error fetching service insights data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [lastRefreshAt, fetchData]);

  const buildServiceDetailUrl = React.useCallback(
    (svc: { cluster: string; namespace: string; serviceName: string }) => {
      const clusterParam =
        isMultiCluster && svc.cluster && svc.cluster !== 'unknown'
          ? `?${URLParam.CLUSTERNAME}=${encodeURIComponent(svc.cluster)}`
          : '';
      return `/${Paths.NAMESPACES}/${svc.namespace}/${Paths.SERVICES}/${svc.serviceName}${clusterParam}`;
    },
    []
  );

  interface ServiceTableConfig<T> {
    columnTitle: string;
    data: T[];
    dataTestId: string;
    emptyMessage: string;
    emptyTitle: string;
    keyPrefix: string;
    renderValueCell: (item: T) => React.ReactNode;
  }

  const renderServiceTable = <
    T extends { cluster: string; healthStatus?: string; namespace: string; serviceName: string }
  >(
    config: ServiceTableConfig<T>
  ): React.ReactNode => {
    if (config.data.length === 0) {
      return (
        <div className={emptyStateStyle}>
          <div>{t(config.emptyTitle)}</div>
          <div>{t(config.emptyMessage)}</div>
        </div>
      );
    }

    return (
      <table className={tableStyle} data-test={config.dataTestId}>
        <colgroup>
          <col style={{ width: '60%' }} />
          <col style={{ width: '40%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={tableHeaderStyle}>{t('Name')}</th>
            <th className={tableHeaderStyle}>
              <span>{t(config.columnTitle)}</span>
              <LongArrowAltDownIcon className={sortIconDisabledStyle} aria-hidden={true} />
            </th>
          </tr>
        </thead>
        <tbody>
          {config.data.map((svc, idx) => (
            <tr
              key={`${config.keyPrefix}-${svc.cluster}-${svc.namespace}-${svc.serviceName}-${idx}`}
              className={tableRowStyle}
            >
              <td className={tableCellStyle}>
                <Tooltip content={buildTooltipContent(svc.cluster, svc.namespace, svc.serviceName)}>
                  <KialiLink to={buildServiceDetailUrl(svc)} className={serviceLinkStyle}>
                    {svc.serviceName}
                  </KialiLink>
                </Tooltip>
              </td>
              <td className={rateCellStyle}>{config.renderValueCell(svc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderLatenciesTable = (): React.ReactNode => {
    return renderServiceTable({
      data: latencies,
      dataTestId: 'service-insights-latencies-table',
      emptyTitle: 'Latencies not available',
      emptyMessage: 'No HTTP traffic or response time metrics are unavailable',
      columnTitle: 'Latency',
      keyPrefix: 'latency',
      renderValueCell: svc => (
        <>
          {createIcon({ ...statusFromString(svc.healthStatus ?? 'NA'), className: statusIconStyle })}
          {formatLatency(svc.latency)}
        </>
      )
    });
  };

  const renderRatesTable = (): React.ReactNode => {
    return renderServiceTable({
      data: rates,
      dataTestId: 'service-insights-rates-table',
      emptyTitle: 'Error Rates not available',
      emptyMessage: 'No HTTP traffic or health cache is disabled',
      columnTitle: 'Errors',
      keyPrefix: 'rate',
      renderValueCell: svc => (
        <Tooltip content={formatRequestRate(t, svc.requestRate ?? 0)} position={TooltipPosition.top}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {createIcon({ ...statusFromString(svc.healthStatus ?? 'NA'), className: statusIconStyle })}
            {formatErrorRate(Math.max(0, Math.min(1, svc.errorRate)))}
          </span>
        </Tooltip>
      )
    });
  };

  const renderThroughputTable = (): React.ReactNode => {
    return renderServiceTable({
      data: throughput,
      dataTestId: 'service-insights-traffic-table',
      emptyTitle: 'Throughput not available',
      emptyMessage: 'No throughput metrics are available',
      columnTitle: 'Throughput',
      keyPrefix: 'traffic',
      renderValueCell: svc => (
        <Tooltip
          content={`TCP sent bytes: ${formatByteRate(svc.tcpRate ?? 0)} (bytes returned by the destination service)`}
          position={TooltipPosition.top}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            {createIcon({ ...statusFromString(svc.healthStatus ?? 'NA'), className: statusIconStyle })}
            {formatByteRate(svc.tcpRate ?? 0)}
          </span>
        </Tooltip>
      )
    });
  };

  const effectiveMetrics = React.useMemo(() => {
    return {
      errorRates: selectedMetrics.errorRates,
      latency: selectedMetrics.latency,
      tcp: selectedMetrics.tcp
    };
  }, [selectedMetrics.errorRates, selectedMetrics.latency, selectedMetrics.tcp]);

  const visibleTablesCount = React.useMemo(() => {
    return Number(effectiveMetrics.errorRates) + Number(effectiveMetrics.latency) + Number(effectiveMetrics.tcp);
  }, [effectiveMetrics]);

  const visibleErrorCount = React.useMemo(() => {
    return (
      Number(effectiveMetrics.errorRates && ratesError) +
      Number(effectiveMetrics.latency && latenciesError) +
      Number(effectiveMetrics.tcp && throughputError)
    );
  }, [effectiveMetrics, latenciesError, ratesError, throughputError]);

  const showCardErrorState = React.useMemo(() => {
    if (isLoading) {
      return false;
    }
    // All requests failed (e.g. no URL preference and all returned error → selectedMetrics become all false)
    if (isError) {
      return true;
    }
    if (visibleTablesCount === 0) {
      return false;
    }
    return visibleErrorCount === visibleTablesCount;
  }, [isError, isLoading, visibleErrorCount, visibleTablesCount]);

  const allVisibleTablesEmpty = React.useMemo(() => {
    const ratesEmpty = !effectiveMetrics.errorRates || rates.length === 0;
    const latenciesEmpty = !effectiveMetrics.latency || latencies.length === 0;
    const throughputEmpty = !effectiveMetrics.tcp || throughput.length === 0;
    return ratesEmpty && latenciesEmpty && throughputEmpty;
  }, [
    effectiveMetrics.errorRates,
    effectiveMetrics.latency,
    effectiveMetrics.tcp,
    rates.length,
    latencies.length,
    throughput.length
  ]);

  const showNoDataMessage = hasUrlPreference && visibleTablesCount > 0 && allVisibleTablesEmpty && !showCardErrorState;

  const renderContent = (): React.ReactNode => {
    if (isLoading) {
      return <OverviewCardLoadingState message={t('Fetching service data')} />;
    }

    if (showCardErrorState) {
      return <OverviewCardErrorState message={t('Failed to load service data')} onTryAgain={fetchData} />;
    }

    if (!effectiveMetrics.errorRates && !effectiveMetrics.latency && !effectiveMetrics.tcp) {
      return (
        <div className={emptyStateStyle}>
          <div>{t('No metrics selected')}</div>
        </div>
      );
    }

    if (showNoDataMessage) {
      return <OverviewCardErrorState message={t('Failed to load service data')} onTryAgain={fetchData} />;
    }

    return (
      <div
        className={visibleTablesCount === 1 ? tablesContainer1ColStyle : tablesContainerMultiColStyle}
        style={
          visibleTablesCount > 1
            ? {
                gridTemplateColumns: `repeat(${visibleTablesCount}, minmax(${SERVICE_INSIGHTS_TABLE_MIN_WIDTH_PX}px, 1fr))`
              }
            : undefined
        }
      >
        {effectiveMetrics.errorRates && (
          <div className={tableContainerStyle} data-test="service-insights-rates">
            {renderRatesTable()}
          </div>
        )}
        {effectiveMetrics.latency && (
          <div className={tableContainerStyle} data-test="service-insights-latencies">
            {renderLatenciesTable()}
          </div>
        )}
        {effectiveMetrics.tcp && (
          <div className={tableContainerStyle} data-test="service-insights-traffic">
            {renderThroughputTable()}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={cardStyle} data-test="service-insights-card">
      <CardHeader>
        <CardTitle>
          <div className={cardHeaderTitleLayoutStyle}>
            <div className={cardHeaderTitleLeftStyle}>
              <span>{t('Service Insights')}</span>
              <Popover
                aria-label={t('Service insights information')}
                headerContent={<span>{t('Service Insights')}</span>}
                bodyContent={
                  <>
                    {t(
                      'Top services ranked by throughput (bytes per second), error rate and P95 latency. Status icons indicate health for the time period.'
                    )}
                  </>
                }
                position={PopoverPosition.top}
                triggerAction="hover"
              >
                <KialiIcon.Help className={helpIconStyle} />
              </Popover>
            </div>

            <div className={cardHeaderTitleActionsStyle}>
              <Button
                data-test="service-insights-manage-columns"
                variant="plain"
                aria-label={t('Manage metrics')}
                icon={<CogIcon />}
                onClick={onOpenManageColumns}
              />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>{renderContent()}</CardBody>
      {!isLoading && !showCardErrorState && !showNoDataMessage && (
        <CardFooter>
          <KialiLink
            to={buildServicesListUrl()}
            onClick={() => FilterSelected.resetFilters()}
            dataTest="service-insights-view-all-services"
          >
            {t('View all services')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </KialiLink>
        </CardFooter>
      )}

      <Modal
        id="service-insights-manage-columns-modal"
        data-test="service-insights-manage-columns-modal"
        aria-label={t('Manage metrics')}
        title={t('Manage metrics')}
        variant={ModalVariant.small}
        isOpen={isManageColumnsOpen}
        onClose={onCancelManageColumns}
        actions={[
          <Button
            key="save"
            variant="primary"
            onClick={onSaveManageColumns}
            isDisabled={!draftMetrics.errorRates && !draftMetrics.latency && !draftMetrics.tcp}
          >
            {t('Save')}
          </Button>,
          <Button key="cancel" variant="link" onClick={onCancelManageColumns}>
            {t('Cancel')}
          </Button>
        ]}
      >
        <p style={{ marginTop: 0 }}>
          {t(
            'Select the metrics to display in the Service Insights overview to focus on the telemetry most relevant to your current environment.'
          )}
        </p>

        <Form style={{ marginTop: '1rem' }}>
          <FormGroup fieldId="service-insights-metrics-checkboxes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
              <Button
                variant="link"
                onClick={() => {
                  const allSelected = draftMetrics.errorRates && draftMetrics.latency && draftMetrics.tcp;
                  if (allSelected) {
                    setDraftMetrics({ errorRates: false, latency: false, tcp: false });
                  } else {
                    setDraftMetrics({ errorRates: true, latency: true, tcp: true });
                  }
                }}
                style={{ padding: 0, marginBottom: '0.5rem', textAlign: 'left', textDecoration: 'underline' }}
              >
                {draftMetrics.errorRates && draftMetrics.latency && draftMetrics.tcp
                  ? t('Unselect all')
                  : t('Select all')}
              </Button>
              <Checkbox
                id="service-insights-metrics-error-rates"
                label={t('Error rates')}
                isChecked={draftMetrics.errorRates}
                onChange={(_event, checked) => setDraftMetrics(prev => ({ ...prev, errorRates: checked }))}
              />
              <Checkbox
                id="service-insights-metrics-latency"
                label={t('Latency')}
                isChecked={draftMetrics.latency}
                onChange={(_event, checked) => setDraftMetrics(prev => ({ ...prev, latency: checked }))}
              />
              <Checkbox
                id="service-insights-metrics-tcp"
                label={t('Throughput')}
                isChecked={draftMetrics.tcp}
                onChange={(_event, checked) => setDraftMetrics(prev => ({ ...prev, tcp: checked }))}
              />
            </div>
          </FormGroup>
        </Form>
      </Modal>
    </Card>
  );
};
