import * as React from 'react';
import {
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
import type { TOptions } from 'i18next';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiLink } from 'components/Link/KialiLink';
import { PFColors } from 'components/Pf/PfColors';
import { createIcon, KialiIcon } from 'config/KialiIcon';
import { isMultiCluster, Paths } from 'config';
import { cardStyle, cardBodyStyle, iconStyle } from './OverviewStyles';
import { useKialiTranslation } from 'utils/I18nUtils';
import * as API from 'services/Api';
import { statusFromString } from 'types/Health';
import { ServiceLatency, ServiceRequests } from 'types/Overview';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { useRefreshInterval } from 'hooks/refresh';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import { useKialiSelector } from 'hooks/redux';
import { activeNamespacesSelector, namespaceItemsSelector } from 'store/Selectors';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { URLParam } from 'app/History';
import { helpIconStyle } from 'styles/IconStyle';

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

const formatRequestRate = (t: (key: string, opts?: TOptions) => string, reqPerSec: number): string => {
  if (reqPerSec >= 1000) {
    return t('{{rate}}k req/s', { rate: (reqPerSec / 1000).toFixed(2) });
  }
  return t('{{rate}} req/s', { rate: reqPerSec.toFixed(2) });
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
                  'Top services ranked by error rate and P95 latency. Status icons indicate health for the time period. Services with identical error rates are sorted by request rate.'
                )}
              </>
            }
            position={PopoverPosition.top}
          >
            <KialiIcon.Help className={helpIconStyle} />
          </Popover>
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
    </Card>
  );
};
