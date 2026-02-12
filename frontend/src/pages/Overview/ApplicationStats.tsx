import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@patternfly/react-core';
import { ChartDonut } from '@patternfly/react-charts/victory';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { useApplications } from 'hooks/applications';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle } from './OverviewStyles';
import { AppHealth, DEGRADED, FAILURE, HEALTHY, NA, NOT_READY, Status } from 'types/Health';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { router } from 'app/History';
import { useKialiSelector } from 'hooks/redux';
import { namespaceItemsSelector } from 'store/Selectors';

const chartContainerStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '4rem',
  marginTop: '1rem'
});

const legendContainerStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
});

const legendItemStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: PFColors.Link,
  cursor: 'pointer'
});

const legendIconStyle = kialiStyle({
  width: '1rem',
  height: '1rem'
});

export const ApplicationStats: React.FC = () => {
  const { applications, duration } = useApplications();
  const allNamespaces = useKialiSelector(namespaceItemsSelector);

  // Calculate stats from applications
  const total = applications.length;
  let healthy = 0;
  let degraded = 0;
  let failure = 0;
  let notReady = 0;
  let noHealthInfo = 0;

  applications.forEach(app => {
    const appHealth = AppHealth.fromJson(app.namespace, app.name, app.health, {
      rateInterval: duration,
      hasSidecar: app.istioSidecar,
      hasAmbient: app.isAmbient
    });

    const globalStatus: Status = appHealth.getStatus();

    switch (globalStatus) {
      case HEALTHY:
        healthy++;
        break;
      case DEGRADED:
        degraded++;
        break;
      case FAILURE:
        failure++;
        break;
      case NOT_READY:
        notReady++;
        break;
      default:
        noHealthInfo++;
    }
  });

  const navigateToApplications = (): void => {
    // Pass all available namespaces to show everything
    const namespaces = allNamespaces ? allNamespaces.map(ns => ns.name).join(',') : '';
    let url = `/${Paths.APPLICATIONS}`;

    if (namespaces) {
      url += `?namespaces=${namespaces}`;
    }

    router.navigate(url);
  };

  const navigateToHealthFilter = (healthStatus: string): void => {
    // Set the health filter
    FilterSelected.setSelected({
      filters: [
        {
          category: 'Health',
          value: healthStatus
        }
      ],
      op: 'or'
    });

    // Navigate to applications page with health filter
    navigateToApplications();
  };

  const resetFiltersAndNavigate = (): void => {
    // Clear all filters before navigating
    FilterSelected.resetFilters();

    // Navigate to applications page
    navigateToApplications();
  };

  const chartData = [
    { x: t('Failure'), y: failure },
    { x: t('Degraded'), y: degraded },
    { x: t('Healthy'), y: healthy },
    { x: t('Not ready'), y: notReady },
    { x: t('No health information'), y: noHealthInfo }
  ];

  const colorScale = [PFColors.Danger, PFColors.Warning, PFColors.Success, PFColors.Color200, PFColors.Color100];

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>{t('Applications')}</CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        <div className={chartContainerStyle}>
          <div style={{ width: '280px', height: '280px' }}>
            <ChartDonut
              ariaDesc={t('Application health status')}
              constrainToVisibleArea
              data={chartData}
              labels={({ datum }) => `${datum.x}: ${datum.y}`}
              legendPosition="right"
              padding={{
                bottom: 20,
                left: 20,
                right: 20,
                top: 20
              }}
              title={`${total}`}
              subTitle={t('Total applications')}
              width={225}
              height={225}
              colorScale={colorScale}
            />
          </div>
          <div className={legendContainerStyle}>
            <div className={legendItemStyle} onClick={() => navigateToHealthFilter(FAILURE.id)}>
              <KialiIcon.ExclamationCircle className={legendIconStyle} />
              <span>
                {failure} {t('Failure')}
              </span>
            </div>
            <div className={legendItemStyle} onClick={() => navigateToHealthFilter(DEGRADED.id)}>
              <KialiIcon.ExclamationTriangle className={legendIconStyle} />
              <span>
                {degraded} {t('Degraded')}
              </span>
            </div>
            <div className={legendItemStyle} onClick={() => navigateToHealthFilter(HEALTHY.id)}>
              <KialiIcon.Success className={legendIconStyle} />
              <span>
                {healthy} {t('Healthy')}
              </span>
            </div>
            <div className={legendItemStyle} onClick={() => navigateToHealthFilter(NOT_READY.id)}>
              <KialiIcon.Delete className={legendIconStyle} />
              <span>
                {notReady} {t('Not ready')}
              </span>
            </div>
            <div className={legendItemStyle} onClick={() => navigateToHealthFilter(NA.id)}>
              <KialiIcon.Unknown className={legendIconStyle} />
              <span>
                {noHealthInfo} {t('No health information')}
              </span>
            </div>
          </div>
        </div>
      </CardBody>
      <CardFooter>
        <span onClick={resetFiltersAndNavigate} className={linkStyle} style={{ cursor: 'pointer' }}>
          {t('View all applications')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </span>
      </CardFooter>
    </Card>
  );
};
