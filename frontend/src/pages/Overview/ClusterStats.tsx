import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useClusterStatus } from 'hooks/clusters';
import { Status } from 'types/IstioStatus';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle, statsContainerStyle, statItemStyle } from './OverviewStyles';

export const ClusterStats: React.FC = () => {
  const { isLoading, statusMap } = useClusterStatus();

  // Calculate stats from statusMap
  const total = Object.keys(statusMap).length;
  const healthy = Object.values(statusMap).filter(components =>
    components.every(comp => comp.status === Status.Healthy)
  ).length;
  const unhealthy = total - healthy;

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
              <div className={statItemStyle}>
                <span>{unhealthy}</span>
                <KialiIcon.Error />
              </div>
            )}
            {unhealthy > 0 && <KialiIcon.Warning />}
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
