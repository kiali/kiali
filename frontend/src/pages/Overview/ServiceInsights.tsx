import * as React from 'react';
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Spinner,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle } from './OverviewStyles';
import * as API from 'services/Api';
import { ServiceLatency, ServiceRequests } from 'types/Overview';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { useRefreshInterval } from 'hooks/refresh';

const tablesContainerStyle = kialiStyle({
  display: 'flex',
  gap: '1.5rem'
});

const tableContainerStyle = kialiStyle({
  flex: 1
});

const tableTitleStyle = kialiStyle({
  fontWeight: 600,
  fontSize: '0.875rem',
  marginBottom: '0.5rem',
  color: PFColors.Color200
});

const tableStyle = kialiStyle({
  width: '100%',
  borderCollapse: 'collapse'
});

const tableHeaderStyle = kialiStyle({
  textAlign: 'left',
  padding: '0.5rem',
  borderBottom: `2px solid ${PFColors.BorderColor100}`,
  fontWeight: 600,
  fontSize: '0.875rem',
  color: PFColors.Color200
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
  padding: '0.5rem',
  fontSize: '0.875rem'
});

const metricCellStyle = kialiStyle({
  padding: '0.5rem',
  fontSize: '0.875rem',
  textAlign: 'right',
  fontFamily: 'monospace'
});

const rateCellStyle = kialiStyle({
  padding: '0.5rem',
  fontSize: '0.875rem',
  textAlign: 'right',
  fontFamily: 'monospace',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '0.25rem'
});

const statusIconStyle = kialiStyle({
  width: '1rem',
  height: '1rem'
});

const serviceLinkStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: PFColors.Link
});

const emptyStateStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: PFColors.Color200
});

const formatLatency = (latencyMs: number): string => {
  if (latencyMs >= 1000) {
    return `${(latencyMs / 1000).toFixed(2)}s`;
  }
  return `${latencyMs.toFixed(2)}ms`;
};

const formatErrorRate = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};

const formatRequestRate = (rate: number): string => {
  if (rate >= 1) {
    return `${rate.toFixed(1)} req/s`;
  }
  return `${(rate * 60).toFixed(1)} req/m`;
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
      <div>
        <PFBadge badge={PFBadges.Service} size="sm" /> {serviceName}
      </div>
    </div>
  );
};

export const ServiceInsights: React.FC = () => {
  const { lastRefreshAt } = useRefreshInterval();
  const [isLoading, setIsLoading] = React.useState(true);
  const [latencies, setLatencies] = React.useState<ServiceLatency[]>([]);
  const [rates, setRates] = React.useState<ServiceRequests[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const [latenciesResponse, ratesResponse] = await Promise.all([
        API.getOverviewServiceLatencies({ limit: 5 }),
        API.getOverviewServiceRates({ limit: 5 })
      ]);

      setLatencies(latenciesResponse.data.services || []);
      setRates(ratesResponse.data.services || []);
    } catch (err) {
      setError(t('Failed to load service data'));
      console.error('Error fetching service data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [lastRefreshAt, fetchData]);

  const renderLatenciesTable = (): React.ReactNode => {
    if (latencies.length === 0) {
      return <div className={emptyStateStyle}>{t('No data')}</div>;
    }

    return (
      <table className={tableStyle}>
        <thead>
          <tr>
            <th className={tableHeaderStyle}>{t('Service')}</th>
            <th className={tableHeaderStyle} style={{ textAlign: 'right' }}>
              {t('P95')}
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
                  <Link
                    to={`/${Paths.NAMESPACES}/${svc.namespace}/${Paths.SERVICES}/${svc.serviceName}?clusterName=${svc.cluster}`}
                    className={serviceLinkStyle}
                  >
                    <PFBadge badge={PFBadges.Service} size="sm" />
                    {svc.serviceName}
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
      <table className={tableStyle}>
        <thead>
          <tr>
            <th className={tableHeaderStyle}>{t('Service')}</th>
            <th className={tableHeaderStyle} style={{ textAlign: 'right' }}>
              {t('Error %')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rates.map((svc, idx) => (
            <tr key={`rate-${svc.cluster}-${svc.namespace}-${svc.serviceName}-${idx}`} className={tableRowStyle}>
              <td className={tableCellStyle}>
                <Tooltip content={buildTooltipContent(svc.cluster, svc.namespace, svc.serviceName)}>
                  <Link
                    to={`/${Paths.NAMESPACES}/${svc.namespace}/${Paths.SERVICES}/${svc.serviceName}?clusterName=${svc.cluster}`}
                    className={serviceLinkStyle}
                  >
                    <PFBadge badge={PFBadges.Service} size="sm" />
                    {svc.serviceName}
                  </Link>
                </Tooltip>
              </td>
              <td className={rateCellStyle}>
                {svc.errorRate > 0 ? (
                  <>
                    <KialiIcon.ExclamationCircle className={statusIconStyle} color={PFColors.Danger} />
                    {formatErrorRate(svc.errorRate)}
                  </>
                ) : (
                  <>
                    <KialiIcon.Success className={statusIconStyle} color={PFColors.Success} />
                    {formatRequestRate(svc.requestCount)}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderContent = (): React.ReactNode => {
    if (isLoading) {
      return (
        <div className={emptyStateStyle}>
          <Spinner size="lg" />
        </div>
      );
    }

    if (error) {
      return <div className={emptyStateStyle}>{error}</div>;
    }

    return (
      <div className={tablesContainerStyle}>
        <div className={tableContainerStyle}>
          <div className={tableTitleStyle}>{t('Top Rate')}</div>
          {renderRatesTable()}
        </div>
        <div className={tableContainerStyle}>
          <div className={tableTitleStyle}>{t('Top Latency')}</div>
          {renderLatenciesTable()}
        </div>
      </div>
    );
  };

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>{t('Service Insights')}</CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>{renderContent()}</CardBody>
      <CardFooter>
        <Link to={`/${Paths.SERVICES}`} className={linkStyle}>
          {t('View all services')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
