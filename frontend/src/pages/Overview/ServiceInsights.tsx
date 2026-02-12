import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Popover,
  PopoverPosition,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { LongArrowAltDownIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom-v5-compat';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { createIcon, KialiIcon } from 'config/KialiIcon';
import { isMultiCluster, Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle } from './OverviewStyles';
import * as API from 'services/Api';
import { statusFromString } from 'types/Health';
import { ServiceLatency, ServiceRequests } from 'types/Overview';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { useRefreshInterval } from 'hooks/refresh';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import { useKialiSelector } from 'hooks/redux';
import { activeNamespacesSelector, namespaceItemsSelector } from 'store/Selectors';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { router, URLParam } from 'app/History';
import { helpIconStyle } from 'styles/IconStyle';
import { classes } from 'typestyle';

const tablesContainerStyle = kialiStyle({
  display: 'flex',
  gap: '1.5rem'
});

const tableContainerStyle = kialiStyle({
  flex: 1
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

const formatRequestRate = (reqPerSec: number): string => {
  if (reqPerSec >= 1000) {
    return `${(reqPerSec / 1000).toFixed(2)}k req/s`;
  }
  return `${reqPerSec.toFixed(2)} req/s`;
};

const noUnderlineStyle = kialiStyle({
  textDecoration: 'none',
  $nest: {
    '&, &:hover, &:focus, &:active': {
      textDecoration: 'none'
    }
  }
});

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
  const { lastRefreshAt } = useRefreshInterval();
  const namespaceItems = useKialiSelector(namespaceItemsSelector);
  const activeNamespaces = useKialiSelector(activeNamespacesSelector);

  // Use all known namespaces when available
  const allNamespaceNames = React.useMemo(() => {
    const namespaces = namespaceItems && namespaceItems.length > 0 ? namespaceItems : activeNamespaces;
    return Array.from(new Set(namespaces.map(ns => ns.name))).sort();
  }, [activeNamespaces, namespaceItems]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [latencies, setLatencies] = React.useState<ServiceLatency[]>([]);
  const [rates, setRates] = React.useState<ServiceRequests[]>([]);
  const [isError, setIsError] = React.useState(false);

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

  const navigateToUrl = React.useCallback((url: string): void => {
    FilterSelected.resetFilters();
    router.navigate(url);
  }, []);

  const fetchData = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setIsError(false);

      const [latenciesResponse, ratesResponse] = await Promise.all([
        API.getOverviewServiceLatencies(),
        API.getOverviewServiceRates()
      ]);

      setLatencies(latenciesResponse.data.services || []);
      setRates(ratesResponse.data.services || []);
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
                  <Link to={buildServiceDetailUrl(svc)} className={serviceLinkStyle}>
                    {svc.serviceName}
                  </Link>
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
                  <Link to={buildServiceDetailUrl(svc)} className={serviceLinkStyle}>
                    {svc.serviceName}
                  </Link>
                </Tooltip>
              </td>
              <td className={rateCellStyle}>
                <Tooltip content={formatRequestRate(svc.requestCount ?? 0)} position={TooltipPosition.top}>
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

  const renderContent = (): React.ReactNode => {
    if (isLoading) {
      return <OverviewCardLoadingState message={t('Fetching service data')} />;
    }

    if (isError) {
      return <OverviewCardErrorState message={t('Failed to load service data')} onTryAgain={fetchData} />;
    }

    return (
      <div className={tablesContainerStyle}>
        <div className={tableContainerStyle} data-test="service-insights-rates">
          {renderRatesTable()}
        </div>
        <div className={tableContainerStyle} data-test="service-insights-latencies">
          {renderLatenciesTable()}
        </div>
      </div>
    );
  };

  return (
    <Card className={cardStyle} data-test="service-insights-card">
      <CardHeader>
        <CardTitle>
          <span>{t('Service Insights')}</span>
          <Popover
            aria-label={t('Service insights information')}
            headerContent={<span>{t('Service Insights')}</span>}
            bodyContent={
              <>
                {t(
                  'Lists services by top Error rate and P95 Latency. Status icons reflect the service health for the time period. Hover over the error rate to see the associated request rate. Entries with the same error rate are then ordered by request rate. Hover over a service name to see its cluster and namespace. Click the service name to go to its service detail page.'
                )}
              </>
            }
            position={PopoverPosition.top}
            triggerAction="hover"
          >
            <KialiIcon.Help className={helpIconStyle} />
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>{renderContent()}</CardBody>
      {!isLoading && !isError && (
        <CardFooter>
          <Button
            data-test="service-insights-view-all-services"
            variant="link"
            isInline
            className={classes(linkStyle, noUnderlineStyle)}
            onClick={() => navigateToUrl(buildServicesListUrl())}
          >
            {t('View all services')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
