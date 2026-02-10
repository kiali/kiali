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

const insightsWindowStyle = kialiStyle({
  marginLeft: '0.5rem',
  fontSize: '0.75rem',
  color: PFColors.Color200
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

const metricCellStyle = kialiStyle({
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
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: PFColors.Color200
});

const sortIconDisabledStyle = kialiStyle({
  // "Disabled" sort indicator: visible but not interactive.
  color: PFColors.Black1000,
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

  // Keep this explicit to show in the UI
  const rateInterval = '1h';
  const rateIntervalHoursLabel = '1';

  // Use all known namespaces when available
  const allNamespaceNames = React.useMemo(() => {
    const namespaces = namespaceItems && namespaceItems.length > 0 ? namespaceItems : activeNamespaces;
    return Array.from(new Set(namespaces.map(ns => ns.name))).sort();
  }, [activeNamespaces, namespaceItems]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [latencies, setLatencies] = React.useState<ServiceLatency[]>([]);
  const [rates, setRates] = React.useState<ServiceRequests[]>([]);
  const [isError, setIsError] = React.useState(false);

  const serviceNameCollisions = React.useMemo(() => {
    const namespacesByName = new Map<string, Set<string>>();
    const clustersByName = new Map<string, Set<string>>();
    const all = [...latencies, ...rates];

    all.forEach(svc => {
      const key = svc.serviceName;

      const namespaces = namespacesByName.get(key) ?? new Set<string>();
      namespaces.add(svc.namespace);
      namespacesByName.set(key, namespaces);

      // Ignore "unknown" cluster value when determining collisions.
      if (svc.cluster && svc.cluster !== 'unknown') {
        const clusters = clustersByName.get(key) ?? new Set<string>();
        clusters.add(svc.cluster);
        clustersByName.set(key, clusters);
      }
    });

    const namespaceCollisions = new Set<string>();
    const clusterCollisions = new Set<string>();

    namespacesByName.forEach((namespaces, serviceName) => {
      if (namespaces.size > 1) {
        namespaceCollisions.add(serviceName);
      }
    });

    clustersByName.forEach((clusters, serviceName) => {
      if (clusters.size > 1) {
        clusterCollisions.add(serviceName);
      }
    });

    return {
      hasClusterCollision: (serviceName: string) => clusterCollisions.has(serviceName),
      hasNamespaceCollision: (serviceName: string) => namespaceCollisions.has(serviceName)
    };
  }, [latencies, rates]);

  const formatServiceDisplayName = React.useCallback(
    (svc: { cluster: string; namespace: string; serviceName: string }): string => {
      const showNs = serviceNameCollisions.hasNamespaceCollision(svc.serviceName);
      const showCluster =
        isMultiCluster &&
        svc.cluster &&
        svc.cluster !== 'unknown' &&
        serviceNameCollisions.hasClusterCollision(svc.serviceName);

      if (!showNs && !showCluster) {
        return svc.serviceName;
      }

      const suffixParts: string[] = [];
      if (showNs) {
        suffixParts.push(`NS: ${svc.namespace}`);
      }
      if (showCluster) {
        suffixParts.push(`C: ${svc.cluster}`);
      }

      // Disambiguate only when needed, but avoid making very long labels even longer.
      const suffix = `(${suffixParts.join(', ')})`;
      const withSuffix = `${svc.serviceName}${suffix}`;
      return withSuffix.length <= 32 ? withSuffix : svc.serviceName;
    },
    [serviceNameCollisions]
  );

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
        API.getOverviewServiceLatencies({ limit: 5, rateInterval }),
        API.getOverviewServiceRates({ limit: 5, rateInterval })
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
      return <div className={emptyStateStyle}>{t('No data')}</div>;
    }

    return (
      <table className={tableStyle} data-test="service-insights-latencies-table">
        <colgroup>
          <col style={{ width: '75%' }} />
          <col style={{ width: '25%' }} />
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
                    {formatServiceDisplayName(svc)}
                  </Link>
                </Tooltip>
              </td>
              <td className={metricCellStyle}>{formatLatency(svc.latency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderRatesTable = (): React.ReactNode => {
    if (rates.length === 0) {
      return <div className={emptyStateStyle}>{t('No data')}</div>;
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
                    {formatServiceDisplayName(svc)}
                  </Link>
                </Tooltip>
              </td>
              <td className={rateCellStyle}>
                {createIcon({ ...statusFromString(svc.healthStatus ?? 'NA'), className: statusIconStyle })}
                {svc.errorRate > 0
                  ? formatErrorRate(Math.max(0, Math.min(1, svc.errorRate)))
                  : formatRequestRate(svc.requestCount ?? 0)}
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
                Lists services with the highest <strong>Errors</strong> and <strong>Latency</strong>. Always displays
                the top 5 for each metric, even when all services are healthy.
              </>
            }
            position={PopoverPosition.top}
            triggerAction="hover"
          >
            <KialiIcon.Help className={helpIconStyle} />
          </Popover>
          <span className={insightsWindowStyle}>{`Last ${rateIntervalHoursLabel} hour`}</span>
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
