import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Label,
  Popover,
  PopoverPosition,
  Spinner
} from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useNamespaces } from 'hooks/namespaces';
import { Namespace } from 'types/Namespace';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { helpIconStyle } from 'styles/IconStyle';
import {
  cardStyle,
  cardBodyStyle,
  clickableStyle,
  iconStyle,
  linkStyle,
  popoverFooterStyle,
  popoverHeaderStyle,
  popoverItemStatusStyle,
  popoverItemStyle,
  statItemStyle,
  statsContainerStyle
} from './OverviewStyles';
import { classes } from 'typestyle';
import { HealthStatus, isDegraded, isUnhealthy } from 'utils/HealthUtils';

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

const hasIstioInjection = (ns: Namespace): boolean => {
  return !!ns.labels && (ns.labels['istio-injection'] === 'enabled' || !!ns.labels['istio.io/rev']);
};

// Maximum number of items to show in the popover
const MAX_POPOVER_ITEMS = 3;

interface NamespaceWithHealth extends Namespace {
  healthStatus?: HealthStatus;
}

// Get translated display label for health status
const getHealthStatusLabel = (status?: string): string => {
  switch (status) {
    case HealthStatus.Degraded:
      return t('Degraded');
    case HealthStatus.Unhealthy:
      return t('Unhealthy');
    case HealthStatus.Healthy:
      return t('Healthy');
    default:
      return status ?? t('Unknown');
  }
};

export const NamespaceStats: React.FC = () => {
  const { isLoading, namespaces } = useNamespaces();

  // Calculate stats from namespaces
  const total = namespaces.length;
  let ambient = 0;
  let controlPlane = 0;
  let sidecar = 0;
  let outOfMesh = 0;
  let healthy = 0;
  let unhealthy = 0;
  const namespacesWithIssues: NamespaceWithHealth[] = [];

  namespaces.forEach(ns => {
    if (ns.isControlPlane) {
      controlPlane++;
    } else if (ns.isAmbient) {
      ambient++;
    } else if (hasIstioInjection(ns)) {
      sidecar++;
    } else {
      outOfMesh++;
    }

    // Use healthStatus from namespace data if available (from mock)
    // TODO: Adapt once we have a proper health status from the API
    const nsWithHealth = ns as NamespaceWithHealth;
    if (nsWithHealth.healthStatus === HealthStatus.Unhealthy || nsWithHealth.healthStatus === HealthStatus.Degraded) {
      unhealthy++;
      namespacesWithIssues.push(nsWithHealth);
    } else {
      healthy++;
    }
  });

  // Build URL for "View all" link with filters for unhealthy namespaces
  const getViewAllUrl = (): string => {
    const params: string[] = [];

    // Check which health statuses are present in the unhealthy namespaces
    const hasDegraded = namespacesWithIssues.some(isDegraded);
    const hasUnhealthy = namespacesWithIssues.some(isUnhealthy);

    if (hasDegraded) {
      params.push('health=Degraded');
    }

    if (hasUnhealthy) {
      params.push('health=Failure');
    }

    params.push('opLabel=or');

    return `/${Paths.NAMESPACES}${params.length > 1 ? `?${params.join('&')}` : ''}`;
  };

  const handleViewAllClick = (): void => {
    FilterSelected.resetFilters();
  };

  const popoverContent = (
    <>
      {namespacesWithIssues.slice(0, MAX_POPOVER_ITEMS).map(ns => (
        <div key={`${ns.cluster}-${ns.name}`} className={popoverItemStyle}>
          <PFBadge badge={PFBadges.Namespace} size="sm" />
          <Link to={`/${Paths.NAMESPACES}?namespaces=${ns.name}${ns.cluster ? `&clusterName=${ns.cluster}` : ''}`}>
            {ns.name}
          </Link>
          <span className={popoverItemStatusStyle}>{getHealthStatusLabel(ns.healthStatus)}</span>
        </div>
      ))}
      {namespacesWithIssues.length > MAX_POPOVER_ITEMS && (
        <div className={popoverFooterStyle}>
          <Link to={getViewAllUrl()} onClick={handleViewAllClick}>
            <Button variant="link" isInline>
              {t('View all unhealthy namespaces')}
            </Button>
          </Link>
        </div>
      )}
    </>
  );

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          <span>{`${t('Namespaces')} (${total})`}</span>
          <Popover
            aria-label={t('Namespace information')}
            headerContent={<span>{t('Namespace statistics')}</span>}
            bodyContent={t('Display Istio config types for all namespaces')}
            triggerAction="hover"
          >
            <KialiIcon.Help className={helpIconStyle} />
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {isLoading ? (
          <Spinner size="lg" />
        ) : (
          <div className={namespaceContainerStyle}>
            <div className={statsContainerStyle}>
              {healthy > 0 && (
                <div className={statItemStyle}>
                  <span>{healthy}</span>
                  <KialiIcon.Success />
                </div>
              )}
              {unhealthy > 0 && (
                <Popover
                  aria-label={t('Namespaces with issues')}
                  position={PopoverPosition.right}
                  headerContent={
                    <span className={popoverHeaderStyle}>
                      <KialiIcon.ExclamationTriangle /> {t('Namespaces')}
                    </span>
                  }
                  bodyContent={popoverContent}
                >
                  <div className={classes(statItemStyle, clickableStyle)}>
                    <span className={linkStyle}>{unhealthy}</span>
                    <KialiIcon.ExclamationTriangle />
                  </div>
                </Popover>
              )}
            </div>
            <div className={verticalDividerStyle} />
            <div className={labelsContainerStyle}>
              <div className={labelGroupStyle}>
                {controlPlane > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{controlPlane}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Control Plane')}
                    </Label>
                  </div>
                )}
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
                {outOfMesh > 0 && (
                  <div className={labelItemStyle}>
                    <span className={labelNumberStyle}>{outOfMesh}</span>{' '}
                    <Label variant="outline" className={labelStyle}>
                      {t('Out of mesh')}
                    </Label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardBody>
      <CardFooter>
        <Link to={`/${Paths.NAMESPACES}`} className={linkStyle}>
          {t('View Namespaces')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
