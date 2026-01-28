import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { useIstioConfigStatus } from 'hooks/istioConfigs';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle, statsContainerStyle, statItemStyle } from './OverviewStyles';

export const IstioConfigStats: React.FC = () => {
  const istioConfigStats = useIstioConfigStatus();

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          {t('Istio configs')} ({istioConfigStats.total})
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {istioConfigStats.isLoading ? (
          <Spinner size="lg" />
        ) : (
          <div className={statsContainerStyle}>
            {istioConfigStats.valid > 0 && (
              <div className={statItemStyle}>
                <span>{istioConfigStats.valid}</span>
                <KialiIcon.Success />
              </div>
            )}
            {istioConfigStats.warnings > 0 && (
              <div className={statItemStyle}>
                <span>{istioConfigStats.warnings}</span>
                <KialiIcon.Warning />
              </div>
            )}
            {istioConfigStats.errors > 0 && (
              <div className={statItemStyle}>
                <span>{istioConfigStats.errors}</span>
                <KialiIcon.Error />
              </div>
            )}
          </div>
        )}
      </CardBody>
      <CardFooter>
        <Link to={`/${Paths.ISTIO}`} className={linkStyle}>
          {t('View Istio config')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
