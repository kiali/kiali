import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle } from './OverviewStyles';
import * as API from 'services/Api';
import { ServiceLatency } from 'types/Overview';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { useRefreshInterval } from 'hooks/refresh';

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

const latencyCellStyle = kialiStyle({
  padding: '0.5rem',
  fontSize: '0.875rem',
  textAlign: 'right',
  fontFamily: 'monospace'
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

export const ServiceInsights: React.FC = () => {
  const { lastRefreshAt } = useRefreshInterval();
  const [isLoading, setIsLoading] = React.useState(true);
  const [latencies, setLatencies] = React.useState<ServiceLatency[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const fetchLatencies = React.useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await API.getOverviewServiceLatencies({ limit: 10 });
      setLatencies(response.data.services || []);
    } catch (err) {
      setError(t('Failed to load service latencies'));
      console.error('Error fetching service latencies:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchLatencies();
  }, [lastRefreshAt, fetchLatencies]);

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

    if (latencies.length === 0) {
      return <div className={emptyStateStyle}>{t('No service latency data available')}</div>;
    }

    return (
      <table className={tableStyle}>
        <thead>
          <tr>
            <th className={tableHeaderStyle}>{t('Service')}</th>
            <th className={tableHeaderStyle}>{t('Namespace')}</th>
            <th className={tableHeaderStyle} style={{ textAlign: 'right' }}>
              {t('P95 Latency')}
            </th>
          </tr>
        </thead>
        <tbody>
          {latencies.map((svc, idx) => (
            <tr key={`${svc.cluster}-${svc.namespace}-${svc.serviceName}-${idx}`} className={tableRowStyle}>
              <td className={tableCellStyle}>
                <Link
                  to={`/${Paths.NAMESPACES}/${svc.namespace}/${Paths.SERVICES}/${svc.serviceName}?clusterName=${svc.cluster}`}
                  className={serviceLinkStyle}
                >
                  <PFBadge badge={PFBadges.Service} size="sm" />
                  {svc.serviceName}
                </Link>
              </td>
              <td className={tableCellStyle}>{svc.namespace}</td>
              <td className={latencyCellStyle}>{formatLatency(svc.latency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
