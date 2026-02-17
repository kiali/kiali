import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Flex, FlexItem } from '@patternfly/react-core';
import { ChartDonut } from '@patternfly/react-charts/victory';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { useApplications } from 'hooks/applications';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle } from './OverviewStyles';
import { DEGRADED, FAILURE, HEALTHY, NA, NOT_READY } from 'types/Health';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { router } from 'app/History';
import { useKialiSelector } from 'hooks/redux';
import { namespaceItemsSelector } from 'store/Selectors';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import { ResourcesFullIcon } from '@patternfly/react-icons';

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
  const { apps, isError, isLoading, metrics, retry } = useApplications();
  const allNamespaces = useKialiSelector(namespaceItemsSelector);

  const total = apps.length;
  let healthy = 0;
  let degraded = 0;
  let failure = 0;
  let notReady = 0;
  let noHealthInfo = 0;

  apps.forEach(app => {
    switch (app.healthStatus) {
      case 'Healthy':
        healthy++;
        break;
      case 'Degraded':
        degraded++;
        break;
      case 'Failure':
        failure++;
        break;
      case 'Not Ready':
        notReady++;
        break;
      default:
        noHealthInfo++;
    }
  });

  const navigateToApplications = (): void => {
    const namespaces = allNamespaces ? allNamespaces.map(ns => ns.name).join(',') : '';
    let url = `/${Paths.APPLICATIONS}`;

    if (namespaces) {
      url += `?namespaces=${namespaces}`;
    }

    router.navigate(url);
  };

  const navigateToHealthFilter = (healthStatus: string): void => {
    FilterSelected.setSelected({
      filters: [
        {
          category: 'Health',
          value: healthStatus
        }
      ],
      op: 'or'
    });

    navigateToApplications();
  };

  const resetFiltersAndNavigate = (): void => {
    FilterSelected.resetFilters();
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

  const renderContent = (): React.ReactNode => {
    if (isLoading) {
      return <OverviewCardLoadingState message={t('Fetching applications data...')} diameter="5rem" />;
    }

    if (isError) {
      return <OverviewCardErrorState message={t('Failed to load applications data')} onTryAgain={retry} />;
    }

    return (
      <>
        <CardBody style={{ display: 'flex', marginTop: '1rem' }} data-test="apps-card-rates">
          <Flex style={{ marginLeft: '1.2rem', fontSize: '1rem' }}>
            <FlexItem>
              <ResourcesFullIcon /> {`Inbound ${metrics.rpsIn} RPS`}
              <br />
              <span
                style={{ fontSize: '0.875rem', marginLeft: '1.2rem', color: PFColors.Blue400 }}
              >{`${metrics.no_traffic} apps with no traffic`}</span>
            </FlexItem>
            <FlexItem style={{ marginLeft: '1.2rem' }}>
              <ResourcesFullIcon /> {`Outbound ${metrics.rpsOut} RPS`}
            </FlexItem>
          </Flex>
        </CardBody>
        <CardBody className={cardBodyStyle} data-test="apps-card-health">
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
      </>
    );
  };

  return (
    <Card className={cardStyle} data-test="apps-card">
      <CardHeader>
        <CardTitle>{t('Applications')}</CardTitle>
      </CardHeader>
      {renderContent()}
      {!isLoading && !isError && (
        <CardFooter>
          <span
            data-test="apps-card-view-all"
            onClick={resetFiltersAndNavigate}
            className={linkStyle}
            style={{ cursor: 'pointer' }}
          >
            {t('View all applications')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </span>
        </CardFooter>
      )}
    </Card>
  );
};
