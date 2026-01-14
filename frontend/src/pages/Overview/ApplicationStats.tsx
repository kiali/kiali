import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { cardStyle, insightsCardStyle, cardBodyStyle, linkStyle, iconStyle } from './OverviewStyles';

export const ApplicationStats: React.FC = () => {
  return (
    <Card className={`${cardStyle} ${insightsCardStyle}`}>
      <CardHeader>
        <CardTitle>{t('Applications')}</CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>{/* Applications donut chart will be added later */}</CardBody>
      <CardFooter>
        <Link to={`/${Paths.APPLICATIONS}`} className={linkStyle}>
          {t('View all applications')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
