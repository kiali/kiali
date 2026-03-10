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
import { Link } from 'react-router-dom-v5-compat';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiLink } from 'components/Link/KialiLink';
import { PFColors } from 'components/Pf/PfColors';
import { createIcon, KialiIcon } from 'config/KialiIcon';
import { isMultiCluster, Paths } from 'config';
import { cardStyle, cardBodyStyle, iconStyle } from './OverviewStyles';
import { useKialiTranslation } from 'utils/I18nUtils';
import * as API from 'services/Api';
import { statusFromString } from 'types/Health';
import { ServiceLatency, ServiceRequests, ServiceTraffic } from 'types/Overview';
import { isDataPlaneNamespace } from 'utils/NamespaceUtils';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { useRefreshInterval } from 'hooks/refresh';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import { useKialiSelector } from 'hooks/redux';
import { activeNamespacesSelector, namespaceItemsSelector } from 'store/Selectors';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { URLParam } from 'app/History';
import { helpIconStyle } from 'styles/IconStyle';

const tablesContainer3ColStyle = kialiStyle({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
  gap: '1.5rem',
  alignItems: 'start',
  overflowX: 'auto'
});

const tablesContainer1ColStyle = kialiStyle({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '1.5rem',
  alignItems: 'start'
});

const cardHeaderTitleLayoutStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  gap: '0.5rem'
});

const cardHeaderTitleLeftStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  minWidth: 0
});

const cardHeaderTitleActionsStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem'
});

const tableContainerStyle = kialiStyle({
  minWidth: 0
});

const tableStyle = kialiStyle({
  width: '100%',
  borderCollapse: 'collapse'
});

const tableHeaderStyle = kialiStyle({
  textAlign: 'left',
  padding: '0.75rem',
  borderBottom: 'none',
  fontSize: '0.875rem',
  color: 'var(--pf-t--global--text--color--primary--default)'
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
  padding: '0.75rem',
  fontSize: '0.875rem'
});

const rateCellStyle = kialiStyle({
  padding: '0.75rem',
  fontSize: '0.875rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '0.25rem',
  whiteSpace: 'nowrap'
});

const statusIconStyle = kialiStyle({
  width: '1rem',
  height: '1rem'
});

const serviceLinkStyle = kialiStyle({
  display: 'inline-block',
  color: PFColors.Link,
  textDecoration: 'underline !important',
  $nest: {
    '&, &:hover, &:focus, &:active': {
      textDecoration: 'underline !important'
    }
  }
});

const emptyStateStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: PFColors.Color200
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

const formatByteRate = (bytesPerSec: number): string => {
  const abs = Math.abs(bytesPerSec);
  if (abs < 1024) {
    return `${bytesPerSec.toFixed(2)} B/s`;
  }
  const kib = bytesPerSec / 1024;
  if (Math.abs(kib) < 1024) {
    return `${kib.toFixed(2)} KiB/s`;
  }
  const mib = kib / 1024;
  if (Math.abs(mib) < 1024) {
    return `${mib.toFixed(2)} MiB/s`;
  }
  const gib = mib / 1024;
  return `${gib.toFixed(2)} GiB/s`;
};

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
  const namespaceItems = useKialiSelector(namespaceItemsSelector);
  const activeNamespaces = useKialiSelector(activeNamespacesSelector);

  // Use all known namespaces when available
  const allNamespaceNames = React.useMemo(() => {
    const namespaces = namespaceItems && namespaceItems.length > 0 ? namespaceItems : activeNamespaces;
    return Array.from(new Set(namespaces.map(ns => ns.name))).sort();
  }, [activeNamespaces, namespaceItems]);

  const allNamespacesAmbient = React.useMemo((): boolean => {
    const namespaces = namespaceItems && namespaceItems.length > 0 ? namespaceItems : activeNamespaces;
    if (!namespaces || namespaces.length === 0) {
      return false;
    }
    const dataPlanes = namespaces.filter(isDataPlaneNamespace);
    if (dataPlanes.length === 0) {
      return false;
    }
    return dataPlanes.every(ns => !!ns.isAmbient);
  }, [activeNamespaces, namespaceItems]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [latencies, setLatencies] = React.useState<ServiceLatency[]>([]);
  const [rates, setRates] = React.useState<ServiceRequests[]>([]);
  const [traffic, setTraffic] = React.useState<ServiceTraffic[]>([]);
  const [hasWaypoints, setHasWaypoints] = React.useState<boolean | undefined>(undefined);
  const [isError, setIsError] = React.useState(false);

  const [isManageColumnsOpen, setIsManageColumnsOpen] = React.useState(false);
  const [hasCustomizedMetrics, setHasCustomizedMetrics] = React.useState(false);
  const [selectedMetrics, setSelectedMetrics] = React.useState<{ errorRates: boolean; latency: boolean; tcp: boolean }>(
    {
      errorRates: true,
      latency: true,
      tcp: false
    }
  );
  const [draftMetrics, setDraftMetrics] = React.useState(selectedMetrics);

  const isAmbientOnlyWithoutWaypoints = React.useMemo((): boolean => {
    return allNamespacesAmbient && hasWaypoints === false;
  }, [allNamespacesAmbient, hasWaypoints]);

  React.useEffect(() => {
    if (hasCustomizedMetrics) {
      return;
    }

    // Default behavior:
    // - Non-ambient (or ambient w/ waypoints): show Errors + Latency by default.
    // - Ambient-only without waypoints: show Throughput by default.
    setSelectedMetrics(
      isAmbientOnlyWithoutWaypoints
        ? { errorRates: false, latency: false, tcp: true }
        : { errorRates: true, latency: true, tcp: false }
    );
  }, [hasCustomizedMetrics, isAmbientOnlyWithoutWaypoints]);

  const buildServicesListUrl = React.useCallback((): string => {
    const params = new URLSearchParams();
    if (allNamespaceNames.length > 0) {
      params.set(URLParam.NAMESPACES, allNamespaceNames.join(','));
    }
    params.set(URLParam.DIRECTION, 'asc');
    params.set(URLParam.SORT, 'he');

    const qs = params.toString();
    return `/${Paths.SERVICES}${qs ? `?${qs}` : ''}`;
  }, [allNamespaceNames]);

  const onOpenManageColumns = React.useCallback((): void => {
    setDraftMetrics(selectedMetrics);
    setIsManageColumnsOpen(true);
  }, [selectedMetrics]);

  const onCancelManageColumns = React.useCallback((): void => {
    setIsManageColumnsOpen(false);
  }, []);

  const onSaveManageColumns = React.useCallback((): void => {
    setSelectedMetrics(draftMetrics);
    setHasCustomizedMetrics(true);
    setIsManageColumnsOpen(false);
  }, [draftMetrics]);

  const fetchData = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setIsError(false);

      const [latenciesResult, ratesResult, trafficResult] = await Promise.allSettled([
        API.getOverviewServiceLatencies(),
        API.getOverviewServiceRates(),
        API.getOverviewServiceTraffic()
      ]);

      let anySuccess = false;

      if (latenciesResult.status === 'fulfilled') {
        setLatencies(latenciesResult.value.data.services || []);
        anySuccess = true;
      } else {
        setLatencies([]);
      }

      if (ratesResult.status === 'fulfilled') {
        setRates(ratesResult.value.data.services || []);
        anySuccess = true;
      } else {
        setRates([]);
      }

      if (trafficResult.status === 'fulfilled') {
        setTraffic(trafficResult.value.data.services || []);
        setHasWaypoints(trafficResult.value.data.hasWaypoints);
        anySuccess = true;
      } else {
        setTraffic([]);
        setHasWaypoints(undefined);
      }

      if (!anySuccess) {
        setIsError(true);
      }
    } catch (err) {
      setIsError(true);
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

  const renderLatenciesTable = (): React.ReactNode => {
    if (latencies.length === 0) {
      return (
        <div className={emptyStateStyle}>
          <div>{t('Latencies not available')}</div>
          <div>{t('No HTTP traffic or response time metrics are unavailable')}</div>
        </div>
      );
    }

    return (
      <table className={tableStyle} data-test="service-insights-latencies-table">
        <colgroup>
          <col style={{ width: '60%' }} />
          <col style={{ width: '40%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={tableHeaderStyle}>{t('Name')}</th>
            <th className={tableHeaderStyle}>
              <span>{t('Latency')}</span>
              <LongArrowAltDownIcon className={sortIconDisabledStyle} aria-hidden={true} />
            </th>
          </tr>
        </thead>
        <tbody>
          {latencies.map((svc, idx) => (
            <tr key={`latency-${svc.cluster}-${svc.namespace}-${svc.serviceName}-${idx}`} className={tableRowStyle}>
              <td className={tableCellStyle}>
                <Tooltip
                  content={buildTooltipContent(svc.cluster, svc.namespace, svc.serviceName)}
                  position={TooltipPosition.topStart}
                >
                  <KialiLink to={buildServiceDetailUrl(svc)} className={serviceLinkStyle}>
                    {svc.serviceName}
                  </KialiLink>
                </Tooltip>
              </td>
              <td className={rateCellStyle}>
                {createIcon({
                  ...statusFromString(svc.healthStatus ?? 'NA'),
                  className: statusIconStyle
                })}
                {formatLatency(svc.latency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderRatesTable = (): React.ReactNode => {
    if (rates.length === 0) {
      return (
        <div className={emptyStateStyle}>
          <div>{t('Error Rates not available')}</div>
          <div>{t('No HTTP traffic or health cache is disabled')}</div>
        </div>
      );
    }

    return (
      <table className={tableStyle} data-test="service-insights-rates-table">
        <colgroup>
          <col style={{ width: '60%' }} />
          <col style={{ width: '40%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={tableHeaderStyle}>{t('Name')}</th>
            <th className={tableHeaderStyle}>
              <span>{t('Errors')}</span>
              <LongArrowAltDownIcon className={sortIconDisabledStyle} aria-hidden={true} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rates.map((svc, idx) => (
            <tr key={`rate-${svc.cluster}-${svc.namespace}-${svc.serviceName}-${idx}`} className={tableRowStyle}>
              <td className={tableCellStyle}>
                <Tooltip content={buildTooltipContent(svc.cluster, svc.namespace, svc.serviceName)}>
                  <KialiLink to={buildServiceDetailUrl(svc)} className={serviceLinkStyle}>
                    {svc.serviceName}
                  </KialiLink>
                </Tooltip>
              </td>
              <td className={rateCellStyle}>
                <Tooltip content={formatRequestRate(t, svc.requestRate ?? 0)} position={TooltipPosition.top}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {createIcon({ ...statusFromString(svc.healthStatus ?? 'NA'), className: statusIconStyle })}
                    {formatErrorRate(Math.max(0, Math.min(1, svc.errorRate)))}
                  </span>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderTrafficTable = (): React.ReactNode => {
    if (traffic.length === 0) {
      return (
        <div className={emptyStateStyle}>
          <div>{t('TCP traffic not available')}</div>
          <div>{t('No TCP traffic or TCP metrics are unavailable')}</div>
        </div>
      );
    }

    return (
      <table className={tableStyle} data-test="service-insights-traffic-table">
        <colgroup>
          <col style={{ width: '60%' }} />
          <col style={{ width: '40%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={tableHeaderStyle}>{t('Name')}</th>
            <th className={tableHeaderStyle}>
              <span>{t('Throughput')}</span>
              <LongArrowAltDownIcon className={sortIconDisabledStyle} aria-hidden={true} />
            </th>
          </tr>
        </thead>
        <tbody>
          {traffic.map((svc, idx) => (
            <tr key={`traffic-${svc.cluster}-${svc.namespace}-${svc.serviceName}-${idx}`} className={tableRowStyle}>
              <td className={tableCellStyle}>
                <Tooltip content={buildTooltipContent(svc.cluster, svc.namespace, svc.serviceName)}>
                  <Link to={buildServiceDetailUrl(svc)} className={serviceLinkStyle}>
                    {svc.serviceName}
                  </Link>
                </Tooltip>
              </td>
              <td className={rateCellStyle}>
                <Tooltip content={formatByteRate(svc.tcpRate ?? 0)} position={TooltipPosition.top}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {createIcon({ ...statusFromString(svc.healthStatus ?? 'NA'), className: statusIconStyle })}
                    {formatByteRate(svc.tcpRate ?? 0)}
                  </span>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderContent = (): React.ReactNode => {
    if (isLoading) {
      return <OverviewCardLoadingState message={t('Fetching service data')} />;
    }

    if (isError) {
      return <OverviewCardErrorState message={t('Failed to load service data')} onTryAgain={fetchData} />;
    }

    const effectiveMetrics = {
      errorRates: selectedMetrics.errorRates,
      latency: selectedMetrics.latency,
      tcp: selectedMetrics.tcp
    };
    const visibleTablesCount =
      Number(effectiveMetrics.errorRates) + Number(effectiveMetrics.latency) + Number(effectiveMetrics.tcp);

    if (!effectiveMetrics.errorRates && !effectiveMetrics.latency && !effectiveMetrics.tcp) {
      return (
        <div className={emptyStateStyle}>
          <div>{t('No metrics selected')}</div>
        </div>
      );
    }

    return (
      <div className={visibleTablesCount === 1 ? tablesContainer1ColStyle : tablesContainer3ColStyle}>
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
            {renderTrafficTable()}
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
                      'Top services ranked by TCP bytes per second, error rate and P95 latency. Status icons indicate health for the time period.'
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
                aria-label={t('Manage columns')}
                icon={<CogIcon />}
                onClick={onOpenManageColumns}
              />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>{renderContent()}</CardBody>
      {!isLoading && !isError && (
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
        aria-label={t('Manage columns')}
        title={t('Manage columns')}
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
            'Select de metrics to display in the Service Insights overview to focus on the telemetry most relevant to your current environment.'
          )}
        </p>

        <Form style={{ marginTop: '1rem' }}>
          <FormGroup label={t('Metrics')} fieldId="service-insights-metrics-checkboxes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Checkbox
                id="service-insights-metrics-error-rates"
                label={t('Error rates')}
                isChecked={draftMetrics.errorRates}
                onChange={(_event, checked) => setDraftMetrics(prev => ({ ...prev, errorRates: checked }))}
              />
              <Checkbox
                id="service-insights-metrics-latency"
                label={t('latency')}
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
