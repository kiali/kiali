import * as React from 'react';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { TimeInMilliseconds } from '../../types/Common';
import { ComponentStatus, Status, statusSeverity } from '../../types/IstioStatus';
import { MessageType } from '../../types/MessageCenter';
import { Namespace } from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { istioStatusSelector, namespaceItemsSelector } from '../../store/Selectors';
import { IstioStatusActions } from '../../actions/IstioStatusActions';
import { connect } from 'react-redux';
import { Text, TextVariants, TextContent, Tooltip, TooltipPosition, Label } from '@patternfly/react-core';
import { IstioStatusList } from './IstioStatusList';
import { PFColors } from '../Pf/PfColors';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon,
  QuestionCircleIcon
} from '@patternfly/react-icons';
import { KialiDispatch } from 'types/Redux';
import { connectRefresh } from '../Refresh/connectRefresh';
import { kialiStyle } from 'styles/StyleUtils';
import { IconProps, createIcon, KialiIcon } from 'config/KialiIcon';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { useKialiTranslation } from 'utils/I18nUtils';
import { isControlPlaneAccessible } from '../../utils/MeshUtils';
import { homeCluster } from '../../config';
import { PFBadge, PFBadges } from '../Pf/PfBadges';

export type ClusterStatusMap = { [cluster: string]: ComponentStatus[] };

type ReduxStateProps = {
  namespaces?: Namespace[];
  statusMap: ClusterStatusMap; // map of clusters to ComponentStatus[]
};

type ReduxDispatchProps = {
  setIstioStatus: (statusMap: ClusterStatusMap) => void;
};

type StatusIcons = {
  ErrorIcon?: React.ComponentClass<SVGIconProps>;
  HealthyIcon?: React.ComponentClass<SVGIconProps>;
  InfoIcon?: React.ComponentClass<SVGIconProps>;
  WarningIcon?: React.ComponentClass<SVGIconProps>;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    icons?: StatusIcons;
    lastRefreshAt: TimeInMilliseconds;
  };

const ValidToColor = {
  'true-true-true': PFColors.Danger,
  'true-true-false': PFColors.Danger,
  'true-false-true': PFColors.Danger,
  'true-false-false': PFColors.Danger,
  'false-true-true': PFColors.Warning,
  'false-true-false': PFColors.Warning,
  'false-false-true': PFColors.Info,
  'false-false-false': PFColors.Success
};

const defaultIcons = {
  ErrorIcon: ExclamationCircleIcon,
  HealthyIcon: CheckCircleIcon,
  InfoIcon: InfoCircleIcon,
  WarningIcon: ExclamationTriangleIcon
};

const iconStyle = kialiStyle({
  marginLeft: '0.5rem',
  fontSize: '1rem'
});

const clusterStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  paddingTop: '0.5rem'
});

const addonLabelStyle = kialiStyle({
  textAlign: 'left',
  marginTop: '0.25rem',
  marginBottom: '0.25rem',
  marginLeft: '0.5rem'
});

const coreLabelStyle = kialiStyle({
  textAlign: 'left',
  marginTop: '0.25rem',
  marginBottom: '0.25rem',
  marginLeft: '0.5rem'
});

const addonListStyle = kialiStyle({
  paddingLeft: '0.75rem'
});

const coreListStyle = kialiStyle({
  paddingLeft: '0.75rem'
});

const labelStyle = kialiStyle({
  $nest: {
    '& .pf-v5-c-label__icon': {
      marginRight: '0.5rem'
    }
  }
});

export const meshLinkStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'center',
  marginTop: '0.75rem',
  $nest: {
    '& > span': {
      marginRight: '0.5rem'
    }
  }
});

export const IstioStatusComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const { pathname } = useLocation();

  const { namespaces, setIstioStatus, lastRefreshAt } = props;

  const fetchStatus = React.useCallback((): void => {
    API.getIstioStatus()
      .then(response => {
        const statusMap: ClusterStatusMap = {};

        response.data.forEach(status => {
          if (!statusMap[status.cluster]) {
            statusMap[status.cluster] = [];
          }
          statusMap[status.cluster].push(status);
        });

        setIstioStatus(statusMap);
      })
      .catch(error => {
        // User without namespaces can't have access to mTLS information. Reduce severity to info.
        const informative = namespaces && namespaces.length < 1;

        if (informative) {
          AlertUtils.addError(t('Istio deployment status disabled.'), error, 'default', MessageType.INFO);
        } else {
          AlertUtils.addError(t('Error fetching Istio deployment status.'), error, 'default', MessageType.ERROR);
        }
      });
  }, [namespaces, setIstioStatus, t]);

  React.useEffect(() => {
    // retrieve status for all clusters
    fetchStatus();
  }, [pathname, lastRefreshAt, fetchStatus]);

  const getSeverity = (components: ComponentStatus[]): number =>
    Math.max(
      ...components.map(
        cs =>
          statusSeverity[cs.status] +
          (cs.isCore && statusSeverity[cs.status] !== statusSeverity[Status.Healthy] ? 10 : 0)
      )
    ); // non-health core component has much higher severity

  const sortedClusters = Object.keys(props.statusMap)
    .filter(cl => {
      const components = props.statusMap[cl] || [];
      return components.some(comp => comp.status !== Status.Healthy);
    })
    .sort((a, b) => {
      // Prioritize home cluster if it has failures
      const isHomeA = a === homeCluster?.name;
      const isHomeB = b === homeCluster?.name;
      if (isHomeA && !isHomeB) return -1;
      if (!isHomeA && isHomeB) return 1;

      // Otherwise sort by severity
      const worstA = getSeverity(props.statusMap[a]);
      const worstB = getSeverity(props.statusMap[b]);
      return worstB - worstA;
    })
    .slice(0, 2); // Show only top 2 clusters

  // Check if there are multiple distinct meshes across all components
  const hasMultipleMeshes = (): boolean => {
    const allComponents = Object.values(props.statusMap).flat();
    const meshes = new Set<string>();
    allComponents.forEach(comp => {
      if (comp.mesh) {
        meshes.add(comp.mesh);
      }
    });
    return meshes.size > 1;
  };

  // Split components into core and addon
  const splitComponents = (
    components: ComponentStatus[]
  ): { addon: ComponentStatus[]; core: ComponentStatus[]; mesh: ComponentStatus[] } => {
    const nonhealthy = components.filter((c: ComponentStatus) => c.status !== Status.Healthy);
    return {
      addon: nonhealthy.filter((s: ComponentStatus) => !s.isCore && !s.mesh),
      core: nonhealthy.filter((s: ComponentStatus) => s.isCore),
      mesh: nonhealthy.filter((s: ComponentStatus) => !s.isCore && s.mesh)
    };
  };

  // Render core and addon components
  const renderComponents = (components: ComponentStatus[], cluster: string, isMultiMesh: boolean): React.ReactNode => {
    const { addon, core, mesh } = splitComponents(components);
    const addonCount = addon.length;
    const coreCount = core.length;
    const meshCount = mesh.length;

    // Sort core components by the worst status first
    const sortedCore = [...core].sort((a, b) => {
      const severityA = statusSeverity[a.status] + (a.isCore ? 10 : 0);
      const severityB = statusSeverity[b.status] + (b.isCore ? 10 : 0);
      return severityB - severityA;
    });

    // Sort mesh components by the worst status first
    const sortedMesh = [...mesh].sort((a, b) => {
      const severityA = statusSeverity[a.status];
      const severityB = statusSeverity[b.status];
      return severityB - severityA;
    });

    // Sort addon components by the worst status first
    const sortedAddon = [...addon].sort((a, b) => {
      const severityA = statusSeverity[a.status];
      const severityB = statusSeverity[b.status];
      return severityB - severityA;
    });

    // Always combine core and mesh, core first, then mesh
    const combinedCoreMesh = [...sortedCore, ...sortedMesh];
    const combinedCount = coreCount + meshCount;
    const displayCoreMesh = combinedCoreMesh.slice(0, 3);
    const displayAddon = sortedAddon.slice(0, 2);

    return (
      <>
        {displayCoreMesh.length > 0 && (
          <>
            <Text component={TextVariants.h6} className={coreLabelStyle}>
              {t(isMultiMesh ? 'Mesh ({{count}} issues)' : 'Core ({{count}} issues)', { count: combinedCount })}
            </Text>
            <div className={coreListStyle}>
              <IstioStatusList status={displayCoreMesh} cluster={cluster} />
            </div>
          </>
        )}
        {displayAddon.length > 0 && (
          <>
            <Text component={TextVariants.h6} className={addonLabelStyle}>
              {t('Add-ons ({{count}} issues)', { count: addonCount })}
            </Text>
            <div className={addonListStyle}>
              <IstioStatusList status={displayAddon} cluster={cluster} />
            </div>
          </>
        )}
      </>
    );
  };

  const tooltipContent = (): React.ReactNode => {
    const showMeshGrouping = hasMultipleMeshes();

    return (
      <>
        <TextContent style={{ color: PFColors.White }}>
          <Text component={TextVariants.h4}>{t('Cluster Status')}</Text>
          {sortedClusters.map(cl => {
            const components = props.statusMap[cl] || [];

            return (
              <React.Fragment key={cl}>
                <div className={clusterStyle}>
                  <PFBadge badge={PFBadges.Cluster} size="sm" />
                  {cl}
                  {cl === homeCluster?.name && (
                    <span style={{ marginLeft: '0.25rem' }}>
                      <KialiIcon.Star />
                    </span>
                  )}
                </div>
                {renderComponents(components, cl, showMeshGrouping)}
              </React.Fragment>
            );
          })}
          {!pathname.endsWith('/mesh') && isControlPlaneAccessible() && (
            <div className={meshLinkStyle}>
              <Link to="/mesh">{t('Open Mesh View')}</Link>
            </div>
          )}
        </TextContent>
      </>
    );
  };

  const tooltipColor = (): string => {
    let coreUnhealthy = false;
    let addonUnhealthy = false;
    let notReady = false;
    const values = Object.values(props.statusMap).flat();

    Object.keys(values ?? {}).forEach((compKey: string) => {
      const { status, isCore } = values[compKey];
      const isNotReady: boolean = status === Status.NotReady;
      const isUnhealthy: boolean = status !== Status.Healthy && !isNotReady;

      if (isCore) {
        coreUnhealthy = coreUnhealthy || isUnhealthy;
      } else {
        addonUnhealthy = addonUnhealthy || isUnhealthy;
      }

      notReady = notReady || isNotReady;
    });

    return ValidToColor[`${coreUnhealthy}-${addonUnhealthy}-${notReady}`];
  };

  const healthyComponents = (): boolean => {
    const values = Object.values(props.statusMap).flat();
    return values.reduce((healthy: boolean, compStatus: ComponentStatus) => {
      return healthy && compStatus.status === Status.Healthy;
    }, true);
  };

  const tooltipPosition = TooltipPosition.top;

  let statusIcon: React.ReactElement;

  if (!healthyComponents()) {
    const icons = props.icons ? { ...defaultIcons, ...props.icons } : defaultIcons;
    const iconColor = tooltipColor();
    let icon = QuestionCircleIcon;
    let dataTest = 'istio-status';

    if (iconColor === PFColors.Danger) {
      icon = icons.ErrorIcon;
      dataTest = `${dataTest}-danger`;
    } else if (iconColor === PFColors.Warning) {
      icon = icons.WarningIcon;
      dataTest = `${dataTest}-warning`;
    } else if (iconColor === PFColors.Info) {
      icon = icons.InfoIcon;
      dataTest = `${dataTest}-info`;
    } else if (iconColor === PFColors.Success) {
      icon = icons.HealthyIcon;
      dataTest = `${dataTest}-success`;
    }

    const iconProps: IconProps = {
      className: iconStyle,
      dataTest: dataTest
    };

    statusIcon = createIcon(iconProps, icon, iconColor);
  } else {
    const iconProps: IconProps = {
      className: iconStyle,
      dataTest: 'istio-status-success'
    };

    statusIcon = createIcon(iconProps, defaultIcons.HealthyIcon, ValidToColor['false-false-false']);
  }

  return (
    <Tooltip
      data-test="component-status-tooltip"
      position={tooltipPosition}
      enableFlip={true}
      content={tooltipContent()}
      maxWidth="25rem"
    >
      <>
        {homeCluster?.name && (
          <Label className={labelStyle} data-test="cluster-icon" color="blue" icon={<KialiIcon.Cluster />}>
            {homeCluster?.name}
            {isControlPlaneAccessible() && statusIcon}
          </Label>
        )}
      </>
    </Tooltip>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  namespaces: namespaceItemsSelector(state),
  statusMap: istioStatusSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setIstioStatus: (statusMap: ClusterStatusMap) => {
    dispatch(IstioStatusActions.setinfo(statusMap));
  }
});

export const IstioStatus = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(IstioStatusComponent));
