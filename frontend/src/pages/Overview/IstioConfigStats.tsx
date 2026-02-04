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
  PopoverPosition
} from '@patternfly/react-core';
import { Link } from 'react-router-dom-v5-compat';
import { KialiIcon } from 'config/KialiIcon';
import { Paths } from 'config';
import { t } from 'utils/I18nUtils';
import { IstioConfigStatusLabel, useIstioConfigStatus } from 'hooks/istioConfigs';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { FilterSelected } from 'components/Filters/StatefulFilters';
import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { router } from 'app/History';
import { useKialiSelector } from 'hooks/redux';
import { activeNamespacesSelector, namespaceItemsSelector } from 'store/Selectors';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import {
  cardStyle,
  cardBodyStyle,
  clickableStyle,
  iconStyle,
  linkStyle,
  popoverFooterStyle,
  popoverHeaderStyle,
  popoverItemStyle,
  popoverItemStatusStyle,
  statItemStyle,
  statsContainerStyle
} from './OverviewStyles';
import { classes } from 'typestyle';

const WARNING_FILTERS: IstioConfigStatusLabel[] = [IstioConfigStatusLabel.Warning, IstioConfigStatusLabel.NotValidated];
const ERROR_FILTERS: IstioConfigStatusLabel[] = [IstioConfigStatusLabel.NotValid];

const statusLabelStyle = kialiStyle({
  height: '1.25rem',
  backgroundColor: 'var(--pf-v6-c-label--m-outline--BackgroundColor, transparent)',
  borderColor: 'var(--pf-v6-c-label--m-outline--BorderColor, transparent)',
  borderStyle: 'solid',
  borderWidth: '1px',
  $nest: {
    '& .pf-v6-c-label__icon': {
      marginRight: '0.25rem'
    },
    '& .pf-v6-c-label__content': {
      color: 'var(--pf-t--global--text--color--primary--default)'
    }
  }
});

const noUnderlineStyle = kialiStyle({
  textDecoration: 'none',
  $nest: {
    '&, &:hover, &:focus, &:active': {
      textDecoration: 'none'
    }
  }
});

// Get border color for status label
const getStatusBorderColor = (status: IstioConfigStatusLabel): string => {
  switch (status) {
    case IstioConfigStatusLabel.Warning:
      return PFColors.Warning;
    case IstioConfigStatusLabel.NotValid:
      return PFColors.Danger;
    case IstioConfigStatusLabel.NotValidated:
      return PFColors.Color200;
    default:
      return PFColors.Color200;
  }
};

// Get icon for status label
const getStatusIcon = (status: IstioConfigStatusLabel): React.ReactNode => {
  switch (status) {          
    case IstioConfigStatusLabel.Warning:
      return <KialiIcon.ExclamationTriangle />;
    case IstioConfigStatusLabel.NotValid:
      return <KialiIcon.ExclamationCircle />;
    case IstioConfigStatusLabel.NotValidated:
      return <KialiIcon.InProgressIcon color={PFColors.Color200} />;  
    default:
      return <KialiIcon.InProgressIcon color={PFColors.Color200} />;
  }
};

// Maximum number of items to show in the popover
const MAX_POPOVER_ITEMS = 3;

export const IstioConfigStats: React.FC = () => {
  const istioConfigStats = useIstioConfigStatus();
  const namespaceItems = useKialiSelector(namespaceItemsSelector);
  const activeNamespaces = useKialiSelector(activeNamespacesSelector);

  // Use all known namespaces when available. This lets the /istio page behave as if "Select all" was chosen.
  const allNamespaceNames = React.useMemo(() => {
    const namespaces = namespaceItems && namespaceItems.length > 0 ? namespaceItems : activeNamespaces;
    return Array.from(new Set(namespaces.map(ns => ns.name))).sort();
  }, [activeNamespaces, namespaceItems]);

  const warningIssues = istioConfigStats.issues.filter(i => i.severity === 'warning');
  const errorIssues = istioConfigStats.issues.filter(i => i.severity === 'error');

  const buildIstioListUrl = (opts?: { configFilters?: IstioConfigStatusLabel[]; namespaces?: string[] }): string => {
    const params = new URLSearchParams();
    if (opts?.namespaces && opts.namespaces.length > 0) {
      params.append('namespaces', opts.namespaces.join(','));
    }
    opts?.configFilters?.forEach(label => params.append('config', label));
    if (opts?.configFilters && opts.configFilters.length > 0) {
      params.append('opLabel', 'or');
    }
    const qs = params.toString();
    return `/${Paths.ISTIO}${qs ? `?${qs}` : ''}`;
  };

  const navigateToUrl = (url: string): void => {
    FilterSelected.resetFilters();
    router.navigate(url);
  };

  const buildDetailUrl = (item: typeof istioConfigStats.issues[number]): string => {
    return `/${Paths.ISTIO}/${item.namespace}/${item.kind.toLowerCase()}/${item.name}${
      item.cluster ? `?clusterName=${item.cluster}` : ''
    }`;
  };

  const renderPopoverContent = (
    issues: typeof istioConfigStats.issues,
    viewAllText: string,
    viewAllStatuses: IstioConfigStatusLabel[]
  ): React.ReactNode => {
    return (
      <>
        {issues.slice(0, MAX_POPOVER_ITEMS).map(item => {
          const borderColor = getStatusBorderColor(item.status);
          return (
            <div key={`${item.cluster}-${item.namespace}-${item.kind}-${item.name}`} className={popoverItemStyle}>
              <span>
                <PFBadge badge={PFBadges[item.kind] ?? PFBadges.IstioConfig} size="sm" />
                <Link to={buildDetailUrl(item)}>{item.name}</Link>
              </span>
              <Label
                className={classes(statusLabelStyle, popoverItemStatusStyle)}
                variant="outline"
                icon={getStatusIcon(item.status)}
                style={{ '--pf-v6-c-label--m-outline--BorderColor': borderColor } as React.CSSProperties}
              >
                {t(item.status)}
              </Label>
            </div>
          );
        })}
        {issues.length > MAX_POPOVER_ITEMS && (
          <div className={popoverFooterStyle}>
            <Button
              variant="link"
              isInline
              onClick={() =>
                navigateToUrl(buildIstioListUrl({ configFilters: viewAllStatuses, namespaces: allNamespaceNames }))
              }
            >
              {t(viewAllText)}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <Card className={cardStyle}>
      <CardHeader>
        <CardTitle>
          {t('Istio configs')}
          {!istioConfigStats.isLoading && !istioConfigStats.isError && ` (${istioConfigStats.total})`}
        </CardTitle>
      </CardHeader>
      <CardBody className={cardBodyStyle}>
        {istioConfigStats.isLoading ? (
          <OverviewCardLoadingState message={t('Fetching Istio config data')} />
        ) : istioConfigStats.isError ? (
          <OverviewCardErrorState
            message={t('Istio configs could not be loaded')}
            onTryAgain={istioConfigStats.refresh}
          />
        ) : (
          <div className={statsContainerStyle}>
            {istioConfigStats.valid > 0 && (
              <div className={statItemStyle}>
                <span>{istioConfigStats.valid}</span>
                <KialiIcon.Success />
              </div>
            )}
            {istioConfigStats.warnings > 0 && (
              <Popover
                aria-label={t('Istio configs with warnings')}
                position={PopoverPosition.right}
                headerContent={
                  <span className={popoverHeaderStyle}>
                    <KialiIcon.ExclamationTriangle /> {t('Istio configs')}
                  </span>
                }
                bodyContent={renderPopoverContent(warningIssues, 'View warning Istio configs', WARNING_FILTERS)}
              >
                <div className={classes(statItemStyle, clickableStyle)} data-test="istio-configs-warnings">
                  <span className={linkStyle}>{istioConfigStats.warnings}</span>
                  <KialiIcon.ExclamationTriangle />
                </div>
              </Popover>
            )}
            {istioConfigStats.errors > 0 && (
              <Popover
                aria-label={t('Istio configs with errors')}
                position={PopoverPosition.right}
                headerContent={
                  <span className={popoverHeaderStyle}>
                    <KialiIcon.ExclamationCircle /> {t('Istio configs')}
                  </span>
                }
                bodyContent={renderPopoverContent(errorIssues, 'View invalid Istio configs', ERROR_FILTERS)}
              >
                <div className={classes(statItemStyle, clickableStyle)} data-test="istio-configs-errors">
                  <span className={linkStyle}>{istioConfigStats.errors}</span>
                  <KialiIcon.ExclamationCircle />
                </div>
              </Popover>
            )}
          </div>
        )}
      </CardBody>
      {!istioConfigStats.isLoading && !istioConfigStats.isError && (
        <CardFooter>
          <Button
            variant="link"
            isInline
            className={classes(linkStyle, noUnderlineStyle)}
            onClick={() => navigateToUrl(buildIstioListUrl({ namespaces: allNamespaceNames }))}
          >
            {t('View Istio config')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
