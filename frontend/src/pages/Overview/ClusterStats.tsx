import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useClusterStatus } from 'hooks/clusters';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { PFColors } from 'components/Pf/PfColors';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import { Status } from 'types/IstioStatus';
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
import { isHealthy, isUnhealthy } from 'utils/StatusUtils';
import { isControlPlaneAccessible } from 'utils/MeshUtils';
import { StatCountPopover } from './StatCountPopover';

type ClusterIssue = { issues: number; name: string; unknownStatus: boolean };

export const ClusterStats: React.FC = () => {
  const { isError, isLoading, refresh, statusMap } = useClusterStatus();
  const hasMeshAccess = isControlPlaneAccessible();

  // Calculate stats from statusMap
  const total = Object.keys(statusMap).length;
  const healthy = Object.values(statusMap).filter(components => components.every(isHealthy)).length;
  const unhealthy = total - healthy;

  // Get clusters with issues
  const clustersWithIssues = Object.entries(statusMap).reduce((acc, [clusterName, components]) => {
    // Calculate issues once
    const unhealthyComponents = components.filter(isUnhealthy);
    const issueCount = unhealthyComponents.length;
    const unknownStatus = unhealthyComponents.some(c => c.status === Status.NotFound);

    // Only add to accumulator if there are actual issues
    if (issueCount > 0) {
      acc.push({
        issues: issueCount,
        name: clusterName,
        unknownStatus
      });
    }

    return acc;
  }, [] as ClusterIssue[]);

  const hasUnknownIssues = clustersWithIssues.some(c => c.unknownStatus);
  const hasKnownIssues = clustersWithIssues.some(c => !c.unknownStatus);
  const issuesIcon = hasKnownIssues ? (
    <KialiIcon.ExclamationTriangle />
  ) : hasUnknownIssues ? (
    <KialiIcon.Unknown />
  ) : null;

  const popoverContent = (
    <>
      {clustersWithIssues.map(cluster => (
        <div key={cluster.name} className={popoverItemStyle}>
          <span>
            <PFBadge badge={PFBadges.Cluster} size="sm" />
            {hasMeshAccess ? <Link to={`/${Paths.MESH}?cluster=${cluster.name}`}>{cluster.name}</Link> : cluster.name}
          </span>
          <span className={popoverItemStatusStyle}>
            {cluster.unknownStatus ? t('Unknown status') : t('{{count}} issue', { count: cluster.issues })}
          </span>
        </div>
      ))}
    </>
  );

  return (
    <Card className={cardStyle} data-test="clusters-card">
      <CardHeader>
        <CardTitle data-test="clusters-card-title">
          {t('Clusters')}
          {!isLoading && !isError && ` (${total})`}
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {isLoading ? (
          <OverviewCardLoadingState message={t('Fetching cluster data')} />
        ) : isError ? (
          <OverviewCardErrorState message={t('Clusters could not be loaded')} onTryAgain={refresh} />
        ) : total === 0 ? (
          <div className={statsContainerStyle}>–</div>
        ) : (
          <div className={statsContainerStyle}>
            {healthy > 0 && (
              <div className={statItemStyle} data-test="clusters-healthy">
                <span>{healthy}</span>
                <KialiIcon.Success />
              </div>
            )}
            {unhealthy > 0 && (
              <StatCountPopover
                ariaLabel={t('Clusters with issues')}
                headerContent={
                  <span className={popoverHeaderStyle}>
                    {issuesIcon} {t('Clusters')}
                  </span>
                }
                bodyContent={popoverContent}
                trigger={
                  <div className={classes(statItemStyle, clickableStyle)} data-test="clusters-issues">
                    <span className={linkStyle}>{unhealthy}</span>
                    {issuesIcon}
                  </div>
                }
              />
            )}
          </div>
        )}
      </CardBody>
      {!isLoading && !isError && hasMeshAccess && (
        <CardFooter>
          <Link to={`/${Paths.MESH}`} className={linkStyle}>
            {t('View Mesh')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </Link>
        </CardFooter>
      )}
    </Card>
  );
};
