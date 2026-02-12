import * as React from 'react';
import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { KialiIcon } from 'config/KialiIcon';
import { t } from 'utils/I18nUtils';
import { useControlPlanes } from 'hooks/controlPlanes';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { PFColors } from 'components/Pf/PfColors';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import {
  cardStyle,
  cardBodyStyle,
  clickableStyle,
  iconStyle,
  linkStyle,
  popoverHeaderStyle,
  popoverItemStatusStyle,
  popoverItemStyle,
  statItemStyle,
  statsContainerStyle,
  noUnderlineStyle
} from './OverviewStyles';
import { classes } from 'typestyle';
import { isUnhealthy, isHealthy } from 'utils/StatusUtils';
import { StatCountPopover } from './StatCountPopover';
import { buildControlPlanesUrl, buildMeshUrlWithClusterFilter, navigateToUrl } from './Links';

export const ControlPlaneStats: React.FC = () => {
  const { controlPlanes, isError, isLoading, refresh } = useControlPlanes();

  // Calculate stats from controlPlanes
  const total = controlPlanes.length;
  const healthy = controlPlanes.filter(isHealthy).length;
  const unhealthy = total - healthy;

  // Get control planes with issues
  const controlPlanesWithIssues = controlPlanes.filter(isUnhealthy);

  const popoverContent = (
    <>
      {controlPlanesWithIssues.map(cp => (
        <div key={`${cp.cluster.name}-${cp.istiodName}`} className={popoverItemStyle}>
          <span>
            <PFBadge badge={PFBadges.Istio} size="sm" />
            <Link to={buildMeshUrlWithClusterFilter(cp.cluster.name)}>{cp.istiodName}</Link>
          </span>
          <span className={popoverItemStatusStyle}>{cp.status}</span>
        </div>
      ))}
    </>
  );

  return (
    <Card className={cardStyle} data-test="control-planes-card">
      <CardHeader>
        <CardTitle>
          {t('Control planes')}
          {!isLoading && !isError && ` (${total})`}
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {isLoading ? (
          <OverviewCardLoadingState message={t('Fetching control plane data')} />
        ) : isError ? (
          <OverviewCardErrorState message={t('Control planes could not be loaded')} onTryAgain={refresh} />
        ) : (
          <div className={statsContainerStyle}>
            {healthy > 0 && (
              <div className={statItemStyle}>
                <span>{healthy}</span>
                <KialiIcon.Success />
              </div>
            )}
            {unhealthy > 0 && (
              <StatCountPopover
                ariaLabel={t('Control planes with issues')}
                headerContent={
                  <span className={popoverHeaderStyle}>
                    <KialiIcon.ExclamationTriangle /> {t('Control planes')}
                  </span>
                }
                bodyContent={popoverContent}
                trigger={
                  <div className={classes(statItemStyle, clickableStyle)} data-test="control-planes-issues">
                    <span className={linkStyle}>{unhealthy}</span>
                    <KialiIcon.ExclamationTriangle />
                  </div>
                }
              />
            )}
          </div>
        )}
      </CardBody>
      {!isLoading && !isError && (
        <CardFooter>
          <Button
            variant="link"
            isInline
            className={classes(linkStyle, noUnderlineStyle)}
            onClick={() => navigateToUrl(buildControlPlanesUrl())}
            data-test="control-planes-view-namespaces"
          >
            {t('View Control planes')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
