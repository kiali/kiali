import * as React from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Label, Spinner } from '@patternfly/react-core';
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
import { fetchClusterNamespacesHealth } from 'services/NamespaceHealth';
import { combinedWorstStatus, isDataPlaneNamespace, namespaceStatusesFromNamespaceHealth } from 'utils/NamespaceUtils';
import { addDanger } from 'utils/AlertUtils';
import * as API from 'services/Api';
import { ApiError } from 'types/Api';
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
  const { isLoading, namespaces } = useNamespaces();
  const duration = useSelector(durationSelector) as DurationInSeconds;
  const [isHealthLoading, setIsHealthLoading] = React.useState<boolean>(false);
  const [healthByNamespace, setHealthByNamespace] = React.useState<Record<string, HealthStatusId>>({});

  const handleApiError = React.useCallback((message: string, error: ApiError): void => {
    addDanger(message, API.getErrorString(error));
  }, []);

  const nsKey = React.useCallback((cluster: string | undefined, name: string): string => {
    return `${cluster ?? ''}::${name}`;
  }, []);

  React.useEffect(() => {
    let active = true;

    const fetchHealth = async (): Promise<void> => {
      if (namespaces.length === 0) {
        setHealthByNamespace({});
        return;
      }

      // Overview card is scoped to data-plane namespaces only (ambient or sidecar-injected).
      const dataPlaneNamespaces = namespaces.filter(isDataPlaneNamespace);
      if (dataPlaneNamespaces.length === 0) {
        setHealthByNamespace({});
        return;
      }

      setIsHealthLoading(true);

      // Initialize data-plane namespaces as NA; we will overwrite when health is present.
      const nextHealth: Record<string, HealthStatusId> = {};
      dataPlaneNamespaces.forEach(ns => {
        nextHealth[nsKey(ns.cluster, ns.name)] = NA.id as HealthStatusId;
      });

      // Group namespaces by cluster (undefined cluster => single-cluster mode)
      const namespacesByCluster = new Map<string | undefined, string[]>();
      dataPlaneNamespaces.forEach(ns => {
        const current = namespacesByCluster.get(ns.cluster) || [];
        current.push(ns.name);
        namespacesByCluster.set(ns.cluster, current);
      });

      const clusterResults = await Promise.all(
        Array.from(namespacesByCluster.entries()).map(async ([cluster, nsNames]) => {
          const healthMap = await fetchClusterNamespacesHealth(nsNames, duration, cluster);
          return { cluster, healthMap, nsNames };
        })
      );

      clusterResults.forEach(({ cluster, healthMap, nsNames }) => {
        nsNames.forEach(name => {
          const nsHealth = healthMap.get(name);
          if (!nsHealth) {
            return;
          }

          const statuses = namespaceStatusesFromNamespaceHealth(nsHealth);
          const worst = combinedWorstStatus(statuses.statusApp, statuses.statusService, statuses.statusWorkload);
          nextHealth[nsKey(cluster, name)] = worst.id as HealthStatusId;
        });
      });

      if (active) {
        setHealthByNamespace(nextHealth);
      }
    };

    fetchHealth()
      .catch(err => {
        handleApiError('Could not fetch health', err as ApiError);
      })
      .finally(() => {
        if (active) {
          setIsHealthLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [duration, handleApiError, namespaces, nsKey]);

  // Calculate stats from namespaces
  let ambient = 0;
  let sidecar = 0;
  let healthy = 0;
  type NamespaceWithHealthStatus = Namespace & { healthStatus: HealthStatusId };
  const namespacesFailure: NamespaceWithHealthStatus[] = [];
  const namespacesDegraded: NamespaceWithHealthStatus[] = [];
  const namespacesNotReady: NamespaceWithHealthStatus[] = [];
  const namespacesNA: NamespaceWithHealthStatus[] = [];

  namespaces.forEach(ns => {
    // Overview card focuses on data-plane namespaces
    if (!isDataPlaneNamespace(ns)) {
      return;
    }

    if (ns.isAmbient) {
      ambient++;
    } else {
      // Sidecar-injected data-plane namespace
      sidecar++;
    }

    const healthStatus = healthByNamespace[nsKey(ns.cluster, ns.name)];
    if (healthStatus === FAILURE.id) {
      namespacesFailure.push({ ...ns, healthStatus });
    } else if (healthStatus === DEGRADED.id) {
      namespacesDegraded.push({ ...ns, healthStatus });
    } else if (healthStatus === NOT_READY.id) {
      namespacesNotReady.push({ ...ns, healthStatus });
    } else if (healthStatus === HEALTHY.id) {
      healthy++;
    } else {
      // Treat undefined/missing as NA, but keep NA separate from healthy/unhealthy totals
      namespacesNA.push({ ...ns, healthStatus: NA.id as HealthStatusId });
    }
  });

  const total = ambient + sidecar;

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

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          <span>{`${t('Data planes')} (${total})`}</span>
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {isLoading || isHealthLoading ? (
          <Spinner size="lg" />
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
    </Card>
  );
};
