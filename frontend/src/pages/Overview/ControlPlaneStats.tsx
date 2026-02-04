import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Popover, PopoverPosition } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useControlPlanes } from 'hooks/controlPlanes';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { PFColors } from 'components/Pf/PfColors';
import { URLParam } from 'app/History';
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
  statsContainerStyle
} from './OverviewStyles';
import { classes } from 'typestyle';
import { isUnhealthy, isHealthy } from 'utils/StatusUtils';

export const ControlPlaneStats: React.FC = () => {
  const { controlPlanes, isError, isLoading, refresh } = useControlPlanes();

  const buildMeshUrlWithClusterFilter = React.useCallback((clusterName: string): string => {
    const params = new URLSearchParams();
    // Use Mesh "Hide" expression to effectively filter the view to a single cluster.
    // See Mesh Find/Hide semantics in `pages/Mesh/toolbar/MeshFind.tsx`.
    params.set(URLParam.MESH_HIDE, `cluster!=${clusterName}`);
    return `/${Paths.MESH}?${params.toString()}`;
  }, []);

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
    <Card className={cardStyle}>
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
              <Popover
                aria-label={t('Control planes with issues')}
                position={PopoverPosition.right}
                headerContent={
                  <span className={popoverHeaderStyle}>
                    <KialiIcon.ExclamationTriangle /> {t('Control planes')}
                  </span>
                }
                bodyContent={popoverContent}
              >
                <div className={classes(statItemStyle, clickableStyle)} data-test="control-planes-issues">
                  <span className={linkStyle}>{unhealthy}</span>
                  <KialiIcon.ExclamationTriangle />
                </div>
              </Popover>
            )}
          </div>
        )}
      </CardBody>
      {!isLoading && !isError && (
        <CardFooter>
          <Link to={`/${Paths.MESH}`} className={linkStyle}>
            {t('View control planes')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </Link>
        </CardFooter>
      )}
    </Card>
  );
};
