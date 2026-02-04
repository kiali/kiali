import * as React from 'react';
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Popover,
  PopoverPosition,
  Spinner
} from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useClusterStatus } from 'hooks/clusters';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { PFColors } from 'components/Pf/PfColors';
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
import { ClusterIssue, isHealthy, isUnhealthy } from 'utils/StatusUtils';

export const ClusterStats: React.FC = () => {
  const { isLoading, statusMap } = useClusterStatus();

  // Calculate stats from statusMap
  const total = Object.keys(statusMap).length;
  const healthy = Object.values(statusMap).filter(components => components.every(isHealthy)).length;
  const unhealthy = total - healthy;

  // Get clusters with issues
  const clustersWithIssues = Object.entries(statusMap).reduce((acc, [clusterName, components]) => {
    // Calculate issues once
    const issueCount = components.filter(isUnhealthy).length;

    // Only add to accumulator if there are actual issues
    if (issueCount > 0) {
      acc.push({
        name: clusterName,
        issues: issueCount
      });
    }

    return acc;
  }, [] as ClusterIssue[]);

  const popoverContent = (
    <>
      {clustersWithIssues.map(cluster => (
        <div key={cluster.name} className={popoverItemStyle}>
          <PFBadge badge={PFBadges.Cluster} size="sm" />
          <Link to={`/${Paths.MESH}?cluster=${cluster.name}`}>{cluster.name}</Link>
          <span className={popoverItemStatusStyle}>{t('{{count}} issue', { count: cluster.issues })}</span>
        </div>
      ))}
    </>
  );

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          {t('Clusters')} ({total})
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {isLoading ? (
          <Spinner size="lg" />
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
                aria-label={t('Clusters with issues')}
                position={PopoverPosition.right}
                headerContent={
                  <span className={popoverHeaderStyle}>
                    <KialiIcon.ExclamationTriangle /> {t('Clusters')}
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
        )}
      </CardBody>
      <CardFooter>
        <Link to={`/${Paths.MESH}`} className={linkStyle}>
          {t('View Mesh')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
