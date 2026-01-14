import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useClusterStatus } from 'hooks/clusters';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle, statsContainerStyle, statItemStyle } from './OverviewStyles';

export const ClusterStats: React.FC = () => {
  const clusterStats = useClusterStatus();

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          {t('Clusters')} ({clusterStats.total})
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {clusterStats.isLoading ? (
          <Spinner size="lg" />
        ) : (
          <div className={statsContainerStyle}>
            {clusterStats.healthy > 0 && (
              <div className={statItemStyle}>
                <span>{clusterStats.healthy}</span>
                <KialiIcon.Success />
              </div>
            )}
            {clusterStats.unhealthy > 0 && (
              <div className={statItemStyle}>
                <span>{clusterStats.unhealthy}</span>
                <KialiIcon.Error />
              </div>
            )}
            {clusterStats.unhealthy > 0 && <KialiIcon.Warning />}
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
