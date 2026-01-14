import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { t } from 'utils/I18nUtils';
import { useControlPlaneStatus } from 'hooks/controlPlanes';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle, statsContainerStyle, statItemStyle } from './OverviewStyles';

export const ControlPlaneStats: React.FC = () => {
  const controlPlaneStats = useControlPlaneStatus();

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          {t('Control planes')} ({controlPlaneStats.total})
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {controlPlaneStats.isLoading ? (
          <Spinner size="lg" />
        ) : (
          <div className={statsContainerStyle}>
            {controlPlaneStats.healthy > 0 && (
              <div className={statItemStyle}>
                <span>{controlPlaneStats.healthy}</span>
                <KialiIcon.Success />
              </div>
            )}
            {controlPlaneStats.unhealthy > 0 && (
              <div className={statItemStyle}>
                <span>{controlPlaneStats.unhealthy}</span>
                <KialiIcon.Error />
              </div>
            )}
            {controlPlaneStats.unhealthy > 0 && <KialiIcon.Warning />}
          </div>
        )}
      </CardBody>
      <CardFooter>
        <Link to="/legacy-overview" className={linkStyle}>
          {t('View control planes')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
