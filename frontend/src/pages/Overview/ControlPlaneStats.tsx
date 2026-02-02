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
import { useControlPlanes } from 'hooks/controlPlanes';
import { Status } from 'types/IstioStatus';
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

export const ControlPlaneStats: React.FC = () => {
  const { controlPlanes, isLoading } = useControlPlanes();

  // Calculate stats from controlPlanes
  const total = controlPlanes.length;
  const healthy = controlPlanes.filter(cp => cp.status === Status.Healthy).length;
  const unhealthy = total - healthy;

  // Get control planes with issues
  const controlPlanesWithIssues = controlPlanes.filter(cp => cp.status !== Status.Healthy);

  const popoverContent = (
    <>
      {controlPlanesWithIssues.map(cp => (
        <div key={`${cp.cluster.name}-${cp.istiodName}`} className={popoverItemStyle}>
          <span>
            <PFBadge badge={PFBadges.Istio} size="sm" />
            <Link to={`/${Paths.MESH}?cluster=${cp.cluster.name}`}>{cp.istiodName}</Link>
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
          {t('View control planes')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
