import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useControlPlanes } from 'hooks/controlPlanes';
import { Status } from 'types/IstioStatus';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle, statsContainerStyle, statItemStyle } from './OverviewStyles';

export const ControlPlaneStats: React.FC = () => {
  const { controlPlanes, isLoading } = useControlPlanes();

  // Calculate stats from controlPlanes
  const total = controlPlanes.length;
  const healthy = controlPlanes.filter(cp => cp.status === Status.Healthy).length;
  const unhealthy = total - healthy;

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          {t('Control planes')} ({total})
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
          </div>
        )}
      </CardBody>
      <CardFooter>
        <Link to={`/${Paths.MESH}`} className={linkStyle}>
          {t('View control planes')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
