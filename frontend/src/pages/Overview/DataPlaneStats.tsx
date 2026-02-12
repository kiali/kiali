import * as React from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Label } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon, createIcon } from 'config/KialiIcon';
import { t } from 'utils/I18nUtils';
import { useNamespaces } from 'hooks/namespaces';
import { Namespace } from 'types/Namespace';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { useSelector } from 'react-redux';
import { durationSelector } from 'store/Selectors';
import { DurationInSeconds } from 'types/Common';
import { DEGRADED, FAILURE, HEALTHY, HealthStatusId, NA, NOT_READY } from 'types/Health';
import { useDataPlanes } from 'hooks/dataPlanes';
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
  statsContainerStyle,
  statusLabelStyle
} from './OverviewStyles';
import { classes } from 'typestyle';
import { StatCountPopover } from './StatCountPopover';
import { buildDataPlanesUrl, navigateToUrl } from './Links';
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
  type NamespaceWithHealthStatus = Namespace & { healthStatus: HealthStatusId };
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
    viewAllStatus: HealthStatusId,
    viewAllText: string
  ): React.ReactNode => (
    <>
      {list.slice(0, MAX_POPOVER_ITEMS).map(ns => (
        <div key={`${ns.cluster}-${ns.name}`} className={popoverItemStyle}>
          <span>
            <PFBadge badge={PFBadges.Namespace} size="sm" />
            {ns.name}
          </span>
          <Label
            className={classes(statusLabelStyle, popoverItemStatusStyle)}
            variant="outline"
            icon={createIcon(
              ns.healthStatus === FAILURE.id
                ? FAILURE
                : ns.healthStatus === DEGRADED.id
                ? DEGRADED
                : ns.healthStatus === NOT_READY.id
                ? NOT_READY
                : NA
            )}
            style={
              {
                '--pf-v6-c-label--m-outline--BorderColor':
                  ns.healthStatus === FAILURE.id
                    ? FAILURE.color
                    : ns.healthStatus === DEGRADED.id
                    ? DEGRADED.color
                    : ns.healthStatus === NOT_READY.id
                    ? NOT_READY.color
                    : NA.color
              } as React.CSSProperties
            }
          >
            {getHealthStatusLabel(ns.healthStatus)}
          </Label>
        </div>
      ))}
      {list.length > MAX_POPOVER_ITEMS && (
        <div className={popoverFooterStyle}>
          <Button
            variant="link"
            isInline
            className={classes(linkStyle, noUnderlineStyle)}
            onClick={() => navigateToUrl(buildDataPlanesUrl(viewAllStatus))}
          >
            {viewAllText}
          </Button>
        </div>
      )}
    </>
  );

  const failureCount = namespacesFailure.length;
  const degradedCount = namespacesDegraded.length;
  const notReadyCount = namespacesNotReady.length;
  const naCount = namespacesNA.length;
  const isCardLoading = isNamespacesLoading || isHealthLoading;
  const isCardError = isNamespacesError || isError;

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
              {failureCount > 0 && (
                <StatCountPopover
                  ariaLabel={t('Namespaces in Failure')}
                  triggerAction="click"
                  showClose={true}
                  headerContent={
                    <span className={popoverHeaderStyle}>
                      {createIcon(FAILURE)} {t('Data planes')}
                    </span>
                  }
                  bodyContent={popoverContentFor(
                    namespacesFailure,
                    FAILURE.id as HealthStatusId,
                    t('View all failure namespaces')
                  )}
                  trigger={
                    <div className={classes(statItemStyle, clickableStyle)} data-test="data-planes-failure">
                      <span className={linkStyle}>{failureCount}</span>
                      {createIcon(FAILURE)}
                    </div>
                  }
                />
              )}
              {degradedCount > 0 && (
                <StatCountPopover
                  ariaLabel={t('Namespaces in Degraded')}
                  triggerAction="click"
                  showClose={true}
                  headerContent={
                    <span className={popoverHeaderStyle}>
                      {createIcon(DEGRADED)} {t('Data planes')}
                    </span>
                  }
                  bodyContent={popoverContentFor(
                    namespacesDegraded,
                    DEGRADED.id as HealthStatusId,
                    t('View all degraded namespaces')
                  )}
                  trigger={
                    <div className={classes(statItemStyle, clickableStyle)} data-test="data-planes-degraded">
                      <span className={linkStyle}>{degradedCount}</span>
                      {createIcon(DEGRADED)}
                    </div>
                  }
                />
              )}
              {notReadyCount > 0 && (
                <StatCountPopover
                  ariaLabel={t('Namespaces in Not Ready')}
                  triggerAction="click"
                  showClose={true}
                  headerContent={
                    <span className={popoverHeaderStyle}>
                      {createIcon(NOT_READY)} {t('Data planes')}
                    </span>
                  }
                  bodyContent={popoverContentFor(
                    namespacesNotReady,
                    NOT_READY.id as HealthStatusId,
                    t('View all not ready namespaces')
                  )}
                  trigger={
                    <div className={classes(statItemStyle, clickableStyle)} data-test="data-planes-not-ready">
                      <span className={linkStyle}>{notReadyCount}</span>
                      {createIcon(NOT_READY)}
                    </div>
                  }
                />
              )}
              {naCount > 0 && (
                <StatCountPopover
                  ariaLabel={t('Namespaces with no health information')}
                  triggerAction="click"
                  showClose={true}
                  headerContent={
                    <span className={popoverHeaderStyle}>
                      {createIcon(NA)} {t('Data planes')}
                    </span>
                  }
                  bodyContent={popoverContentFor(namespacesNA, NA.id as HealthStatusId, t('View Data planes'))}
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
            data-test="data-planes-view-namespaces"
          >
            {t('View Data planes')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
