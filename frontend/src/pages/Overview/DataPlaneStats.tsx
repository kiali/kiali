import * as React from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Label } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon, createIcon } from 'config/KialiIcon';
import { t } from 'utils/I18nUtils';
import { useNamespaces } from 'hooks/namespaces';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { useSelector } from 'react-redux';
import { durationSelector } from 'store/Selectors';
import { DurationInSeconds } from 'types/Common';
import { DEGRADED, FAILURE, HEALTHY, HealthStatusId, NA, NOT_READY } from 'types/Health';
import { NamespaceWithHealthStatus, useDataPlanes } from 'hooks/dataPlanes';
import {
  cardBodyStyle,
  cardStyle,
  clickableStyle,
  iconStyle,
  linkStyle,
  noUnderlineStyle,
  popoverFooterStyle,
  popoverHeaderStyle,
  popoverItemStatusStyle,
  popoverItemStyle,
  statItemStyle,
  statsContainerStyle
} from './OverviewStyles';
import { classes } from 'typestyle';
import { StatCountPopover } from './StatCountPopover';
import { buildDataPlanesUrl, buildUnhealthyDataPlanesUrl, navigateToUrl } from './Links';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';

const namespaceContainerStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '2rem'
});

const verticalDividerStyle = kialiStyle({
  borderLeft: `1px solid ${PFColors.BorderColor100}`,
  height: '2rem',
  alignSelf: 'center'
});

const labelsContainerStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
});

const labelGroupStyle = kialiStyle({
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap'
});

const labelItemStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
});

const labelNumberStyle = kialiStyle({
  fontSize: '1.5rem'
});

const labelStyle = kialiStyle({
  marginTop: '0.5rem',
  marginBottom: '0.5rem'
});

// Maximum number of items to show in the popover
const MAX_POPOVER_ITEMS = 3;

// Get translated display label for health status
const getHealthStatusLabel = (status?: HealthStatusId): string => {
  switch (status) {
    case DEGRADED.id:
      return DEGRADED.name;
    case FAILURE.id:
      return FAILURE.name;
    case NOT_READY.id:
      return NOT_READY.name;
    case HEALTHY.id:
      return HEALTHY.name;
    case NA.id:
      return 'n/a';
    default:
      return status ?? t('Unknown');
  }
};

export const DataPlaneStats: React.FC = () => {
  const {
    isError: isNamespacesError,
    isLoading: isNamespacesLoading,
    namespaces,
    refresh: refreshNamespaces
  } = useNamespaces();
  const duration = useSelector(durationSelector) as DurationInSeconds;
  const {
    ambient,
    healthy,
    isError,
    isLoading: isHealthLoading,
    namespacesDegraded,
    namespacesFailure,
    namespacesNA,
    namespacesNotReady,
    refresh,
    sidecar,
    total
  } = useDataPlanes(namespaces, duration);

  const popoverContentFor = (
    list: NamespaceWithHealthStatus[],
    viewAll?: {
      onClick: () => void;
      testId?: string;
      text: string;
    }
  ): React.ReactNode => (
    <>
      {list.slice(0, MAX_POPOVER_ITEMS).map(ns => (
        <div key={`${ns.cluster}-${ns.name}`} className={popoverItemStyle}>
          <span>
            <PFBadge badge={PFBadges.Namespace} size="sm" />
            {ns.name}
          </span>
          <span className={popoverItemStatusStyle}>{getHealthStatusLabel(ns.healthStatus)}</span>
        </div>
      ))}
      {viewAll && list.length > MAX_POPOVER_ITEMS && (
        <div className={popoverFooterStyle}>
          <Button
            variant="link"
            isInline
            className={classes(linkStyle, noUnderlineStyle)}
            onClick={viewAll.onClick}
            data-test={viewAll.testId}
          >
            {viewAll.text}
          </Button>
        </div>
      )}
    </>
  );

  const failureCount = namespacesFailure.length;
  const degradedCount = namespacesDegraded.length;
  const notReadyCount = namespacesNotReady.length;
  const naCount = namespacesNA.length;
  const unhealthyCount = failureCount + degradedCount + notReadyCount;
  const isCardLoading = isNamespacesLoading || isHealthLoading;
  const isCardError = isNamespacesError || isError;

  const unhealthyNamespaces: NamespaceWithHealthStatus[] = React.useMemo(() => {
    const severity = (s: HealthStatusId): number => {
      switch (s) {
        case FAILURE.id:
          return 0;
        case DEGRADED.id:
          return 1;
        case NOT_READY.id:
          return 2;
        default:
          return 3;
      }
    };

    // Show the "worst" namespaces first: Failure > Degraded > Not Ready, then alphabetical.
    return [...namespacesFailure, ...namespacesDegraded, ...namespacesNotReady].sort((a, b) => {
      const sev = severity(a.healthStatus) - severity(b.healthStatus);
      if (sev !== 0) {
        return sev;
      }
      return a.name.localeCompare(b.name);
    });
  }, [namespacesDegraded, namespacesFailure, namespacesNotReady]);

  const handleTryAgain = (): void => {
    refreshNamespaces();
    refresh();
  };

  return (
    <Card className={cardStyle} data-test="data-planes-card">
      <CardHeader>
        <CardTitle>
          {t('Data planes')}
          {!isCardLoading && !isCardError && ` (${total})`}
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {isCardLoading ? (
          <OverviewCardLoadingState message={t('Fetching data plane data')} />
        ) : isCardError ? (
          <OverviewCardErrorState message={t('Data planes could not be loaded')} onTryAgain={handleTryAgain} />
        ) : (
          <div className={namespaceContainerStyle}>
            <div className={statsContainerStyle}>
              {healthy > 0 && (
                <div className={statItemStyle} data-test="data-planes-healthy">
                  <span>{healthy}</span>
                  <KialiIcon.Success />
                </div>
              )}
              {unhealthyCount > 0 && (
                <StatCountPopover
                  ariaLabel={t('Unhealthy Data planes')}
                  triggerAction="click"
                  showClose={true}
                  headerContent={
                    <span className={popoverHeaderStyle}>
                      {createIcon(DEGRADED)} {t('Data planes')}
                    </span>
                  }
                  bodyContent={popoverContentFor(unhealthyNamespaces, {
                    onClick: () => navigateToUrl(buildUnhealthyDataPlanesUrl()),
                    testId: 'data-planes-view-unhealthy',
                    text: t('View all Unhealthy Data planes')
                  })}
                  trigger={
                    <div className={classes(statItemStyle, clickableStyle)} data-test="data-planes-unhealthy">
                      <span className={linkStyle}>{unhealthyCount}</span>
                      {createIcon(DEGRADED)}
                    </div>
                  }
                />
              )}
              {naCount > 0 && (
                <StatCountPopover
                  ariaLabel={t('Data planes with no health information')}
                  triggerAction="click"
                  showClose={true}
                  headerContent={
                    <span className={popoverHeaderStyle}>
                      {createIcon(NA)} {t('Data planes')}
                    </span>
                  }
                  bodyContent={popoverContentFor(namespacesNA, {
                    onClick: () => navigateToUrl(buildDataPlanesUrl(NA.id as HealthStatusId)),
                    text: t('View all n/a Data planes')
                  })}
                  trigger={
                    <div className={classes(statItemStyle, clickableStyle)} data-test="data-planes-na">
                      <span className={linkStyle}>{naCount}</span>
                      {createIcon(NA)}
                    </div>
                  }
                />
              )}
            </div>
            <div className={verticalDividerStyle} />
            <div className={labelsContainerStyle}>
              <div className={labelGroupStyle}>
                {ambient > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{ambient}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Ambient')}
                    </Label>
                  </div>
                )}
                {sidecar > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{sidecar}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Sidecar')}
                    </Label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardBody>
      {!isCardLoading && !isCardError && (
        <CardFooter>
          <Button
            variant="link"
            isInline
            className={classes(linkStyle, noUnderlineStyle)}
            onClick={() => navigateToUrl(buildDataPlanesUrl())}
            data-test="data-planes-view"
          >
            {t('View Data planes')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
