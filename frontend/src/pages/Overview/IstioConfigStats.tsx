import * as React from 'react';
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Label,
  Popover,
  PopoverPosition
} from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { KialiLink } from 'components/Link/KialiLink';
import { t } from 'utils/I18nUtils';
import { IstioConfigStatusLabel, useIstioConfigStatus } from 'hooks/istioConfigs';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { PFColors } from 'components/Pf/PfColors';
import { useKialiSelector } from 'hooks/redux';
import { activeNamespacesSelector, namespaceItemsSelector } from 'store/Selectors';
import { OverviewCardErrorState, OverviewCardLoadingState } from './OverviewCardState';
import { buildIstioDetailUrl, buildIstioListUrl } from './LinkBuilder';
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
  statsContainerStyle,
  statusLabelStyle
} from './OverviewStyles';
import { classes } from 'typestyle';
import { FilterSelected } from 'components/Filters/StatefulFilters';

const WARNING_FILTERS: IstioConfigStatusLabel[] = [IstioConfigStatusLabel.Warning, IstioConfigStatusLabel.NotValidated];
const ERROR_FILTERS: IstioConfigStatusLabel[] = [IstioConfigStatusLabel.NotValid];

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
                <KialiLink to={buildIstioDetailUrl(item)} onClick={() => FilterSelected.resetFilters()}>
                  {item.name}
                </KialiLink>
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
            <KialiLink
              to={buildIstioListUrl({ configFilters: viewAllStatuses, namespaces: allNamespaceNames })}
              onClick={() => FilterSelected.resetFilters()}
              className={classes(linkStyle)}
            >
              {t(viewAllText)}
            </KialiLink>
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
          <KialiLink
            to={buildIstioListUrl({ namespaces: allNamespaceNames })}
            onClick={() => FilterSelected.resetFilters()}
          >
            {t('View Istio config')} <KialiIcon.ArrowRight className={iconStyle} color={PFColors.Link} />
          </KialiLink>
        </CardFooter>
      )}
    </Card>
  );
};
