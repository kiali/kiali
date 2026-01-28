import * as React from 'react';
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { cardStyle, cardBodyStyle, linkStyle, iconStyle } from './OverviewStyles';

export const WorkloadInsights: React.FC = () => {
  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>{t('Workload insights')}</CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>{/* Workload insights table will be added later */}</CardBody>
      <CardFooter>
        <Link to={`/${Paths.WORKLOADS}`} className={linkStyle}>
          {t('View all workloads')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
