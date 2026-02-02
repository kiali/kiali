import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Label,
  Popover,
  PopoverPosition,
  Spinner
} from '@patternfly/react-core';
import { ExclamationCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom-v5-compat';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { IstioConfigStatusLabel, useIstioConfigStatus } from 'hooks/istioConfigs';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import {
  cardStyle,
  cardBodyStyle,
  clickableStyle,
  iconStyle,
  linkStyle,
  popoverFooterStyle,
  popoverHeaderStyle,
  popoverItemStyle,
  statItemStyle,
  statsContainerStyle
} from './OverviewStyles';
import { classes } from 'typestyle';

const statusLabelStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-label__icon': {
      marginRight: '0.25rem'
    }
  }
});

// Get border color for status label
const getStatusBorderColor = (status: IstioConfigStatusLabel): string => {
  switch (status) {
    case 'Warning':
      return PFColors.Warning;
    case 'Not Valid':
      return PFColors.Danger;
    case 'Not Validated':
      return PFColors.Color200;
    default:
      return PFColors.Color200;
  }
};

// Get icon for status label
const getStatusIcon = (status: IstioConfigStatusLabel): React.ReactNode => {
  const color = getStatusBorderColor(status);
  switch (status) {
    case 'Warning':
      return <ExclamationTriangleIcon color={color} />;
    case 'Not Valid':
      return <ExclamationCircleIcon color={color} />;
    default:
      return <ExclamationTriangleIcon color={color} />;
  }
};

// Maximum number of items to show in the popover
const MAX_POPOVER_ITEMS = 3;

export const IstioConfigStats: React.FC = () => {
  const istioConfigStats = useIstioConfigStatus();

  const unhealthy = istioConfigStats.errors + istioConfigStats.warnings;

  // Build URL for "View all" link with filters for unhealthy configs
  const getViewIssuesUrl = (): string => {
    const params: string[] = [];

    if (istioConfigStats.warnings > 0) {
      params.push('config=Warning');
    }

    if (istioConfigStats.errors > 0) {
      params.push('config=Not+Valid');
    }

    params.push('opLabel=or');

    return `/${Paths.ISTIO}${params.length > 1 ? `?${params.join('&')}` : ''}`;
  };

  const handleViewAllClick = (): void => {
    FilterSelected.resetFilters();
  };

  const popoverContent = (
    <>
      {istioConfigStats.issues.slice(0, MAX_POPOVER_ITEMS).map(item => {
        const borderColor = getStatusBorderColor(item.status);
        return (
          <div key={`${item.cluster}-${item.namespace}-${item.kind}-${item.name}`} className={popoverItemStyle}>
            <span>
              <PFBadge badge={PFBadges[item.kind]} size="sm" />
              <Link
                to={`/${Paths.ISTIO}/${item.namespace}/${item.kind.toLowerCase()}/${item.name}${
                  item.cluster ? `?clusterName=${item.cluster}` : ''
                }`}
              >
                {item.name}
              </Link>
            </span>
            <Label
              className={statusLabelStyle}
              variant="outline"
              icon={getStatusIcon(item.status)}
              style={
                {
                  '--pf-v6-c-label--m-outline--BorderColor': borderColor,
                  borderColor: borderColor
                } as React.CSSProperties
              }
            >
              {t(item.status)}
            </Label>
          </div>
        );
      })}
      {istioConfigStats.issues.length > MAX_POPOVER_ITEMS && (
        <div className={popoverFooterStyle}>
          <Link to={getViewIssuesUrl()} onClick={handleViewAllClick}>
            <Button variant="link" isInline>
              {t('View all warning Istio configs')}
            </Button>
          </Link>
        </div>
      )}
    </>
  );

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
            {unhealthy > 0 && (
              <Popover
                aria-label={t('Istio configs with issues')}
                position={PopoverPosition.right}
                headerContent={
                  <span className={popoverHeaderStyle}>
                    <KialiIcon.ExclamationTriangle /> {t('Istio configs')}
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
        <Link to={`/${Paths.ISTIO}`} className={linkStyle}>
          {t('View Istio config')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
        </Link>
      </CardFooter>
    </Card>
  );
};
