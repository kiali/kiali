import * as React from 'react';
import { ComponentStatus, Status, statusSeverity } from '../../types/IstioStatus';
import { Namespace } from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { namespaceItemsSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import {
  Content,
  ContentVariants,
  Tooltip,
  TooltipPosition,
  Label,
  Button,
  ButtonVariant,
  Divider
} from '@patternfly/react-core';
import { IstioStatusList } from './IstioStatusList';
import { PFColors } from '../Pf/PfColors';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize, PFFontWeight } from 'styles/PfTypography';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from 'config/KialiIcon';
import { Link, useLocation } from 'react-router-dom-v5-compat';
import { useKialiTranslation } from 'utils/I18nUtils';
import { isControlPlaneAccessible } from '../../utils/MeshUtils';
import { homeCluster } from '../../config';
import { PFBadge, PFBadges } from '../Pf/PfBadges';
import { useClusterStatus, ClusterStatusMap } from '../../hooks/clusters';

export type { ClusterStatusMap };

const ISSUE_COUNT_THRESHOLD = 3;

type ReduxStateProps = {
  namespaces?: Namespace[];
};

type Props = ReduxStateProps;

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

const clusterStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  paddingTop: PFSpacer.xs,
  fontSize: PFFontSize.default,
  fontWeight: PFFontWeight.BodyDefault
});

const addonLabelStyle = kialiStyle({
  textAlign: 'left',
  marginTop: PFSpacer.xs,
  marginBottom: PFSpacer.xs,
  marginLeft: PFSpacer.sm,
  fontSize: PFFontSize.small,
  fontWeight: PFFontWeight.HeadingDefault
});

const coreLabelStyle = kialiStyle({
  textAlign: 'left',
  marginTop: PFSpacer.xs,
  marginBottom: PFSpacer.xs,
  marginLeft: PFSpacer.sm,
  fontSize: PFFontSize.small,
  fontWeight: PFFontWeight.HeadingDefault
});

const addonListStyle = kialiStyle({
  paddingLeft: PFSpacer.sm
});

const coreListStyle = kialiStyle({
  paddingLeft: PFSpacer.sm
});

const dividerStyle = kialiStyle({
  borderTop: `1px solid ${PFColors.Blue300}`,
  marginTop: PFSpacer.sm
});

const clusterStatusHeaderStyle = kialiStyle({
  fontSize: PFFontSize.default,
  fontWeight: PFFontWeight.HeadingDefault,
  marginBottom: PFSpacer.xs
});

export const meshLinkStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'flex-start',
  marginTop: PFSpacer.sm,
  textAlign: 'left',
  $nest: {
    '& > span': {
      marginRight: PFSpacer.sm
    }
  }
});

const tooltipStyle = kialiStyle({
  $nest: {
    '& .pf-v6-c-tooltip__content': {
      backgroundColor: PFColors.BackgroundColor100,
      color: 'var(--pf-t--global--text--color--primary--default)'
    },
    '& .pf-v6-c-tooltip__arrow': {
      backgroundColor: PFColors.BackgroundColor100,
      $nest: {
        '&::before': {
          borderTopColor: PFColors.BackgroundColor100,
          borderBottomColor: PFColors.BackgroundColor100,
          borderLeftColor: PFColors.BackgroundColor100,
          borderRightColor: PFColors.BackgroundColor100
        }
      }
    }
  }
});

export const IstioStatusComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const { pathname } = useLocation();
  const [expandedClusters, setExpandedClusters] = React.useState<Set<string>>(new Set());
  const [tooltipKey, setTooltipKey] = React.useState<number>(0);

  const { namespaces } = props;

  // Memoize options to prevent recreating on every render
  const clusterStatusOptions = React.useMemo(
    () => ({
      hasNamespaces: namespaces ? namespaces.length > 0 : true
    }),
    [namespaces]
  );

  // Use cluster status hook with namespace-aware error handling
  const { statusMap } = useClusterStatus(clusterStatusOptions);

  React.useEffect(() => {
    // Force tooltip to close on route changes by remounting it with a new key
    setTooltipKey(prev => prev + 1);
  }, [pathname]);

  const getSeverity = (components: ComponentStatus[]): number =>
    Math.max(
      ...components.map(
        cs =>
          statusSeverity[cs.status] +
          (cs.isCore && statusSeverity[cs.status] !== statusSeverity[Status.Healthy] ? 10 : 0)
      )
    ); // non-health core component has much higher severity

  const healthyComponents = (): boolean => {
    const values = Object.values(statusMap).flat();
    return values.reduce((healthy: boolean, compStatus: ComponentStatus) => {
      return healthy && compStatus.status === Status.Healthy;
    }, true);
  };

  const allHealthy = healthyComponents();
  const sortedClusters = React.useMemo(() => {
    return Object.keys(statusMap)
      .filter(cl => {
        // When all components are healthy, show all clusters
        // When there are failures, only show clusters with failures
        if (allHealthy) {
          return true;
        }
        const components = statusMap[cl] || [];
        return components.some(comp => comp.status !== Status.Healthy);
      })
      .sort((a, b) => {
        // Prioritize home cluster if it has failures
        const isHomeA = a === homeCluster?.name;
        const isHomeB = b === homeCluster?.name;
        if (isHomeA && !isHomeB) return -1;
        if (!isHomeA && isHomeB) return 1;

        // Otherwise sort by severity
        const worstA = getSeverity(statusMap[a]);
        const worstB = getSeverity(statusMap[b]);
        return worstB - worstA;
      })
      .slice(0, 5); // Show 5 clusters
  }, [statusMap, allHealthy]);

  // Check if there are multiple distinct meshes across all components
  const hasMultipleMeshes = (): boolean => {
    const allComponents = Object.values(statusMap).flat();
    const meshes = new Set<string>();
    allComponents.forEach(comp => {
      if (comp.meshId) {
        meshes.add(comp.meshId);
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
      addon: nonhealthy.filter((s: ComponentStatus) => !s.isCore && !s.meshId),
      core: nonhealthy.filter((s: ComponentStatus) => s.isCore),
      mesh: nonhealthy.filter((s: ComponentStatus) => !s.isCore && s.meshId)
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
    const displayCoreMesh = combinedCoreMesh.slice(0, ISSUE_COUNT_THRESHOLD);
    const displayAddon = sortedAddon.slice(0, ISSUE_COUNT_THRESHOLD);

    const formatLabel = (baseLabel: string, count: number): string => {
      if (count > ISSUE_COUNT_THRESHOLD) {
        return t(`${baseLabel} ({{count}} issues)`, { count });
      }
      return t(baseLabel);
    };

    return (
      <>
        {displayCoreMesh.length > 0 && (
          <>
            <Content component={ContentVariants.h6} className={coreLabelStyle}>
              {formatLabel(isMultiMesh ? 'Mesh' : 'Core', combinedCount)}
            </Content>
            <div className={coreListStyle}>
              <IstioStatusList status={displayCoreMesh} cluster={cluster} />
            </div>
          </>
        )}
        {displayAddon.length > 0 && (
          <>
            <Content component={ContentVariants.h6} className={addonLabelStyle}>
              {formatLabel('Add-ons', addonCount)}
            </Content>
            <div className={addonListStyle}>
              <IstioStatusList status={displayAddon} cluster={cluster} />
            </div>
          </>
        )}
      </>
    );
  };

  // Initialize first cluster as expanded when clusters change
  React.useEffect(() => {
    setExpandedClusters(prev => {
      // Only initialize if we have multiple clusters and nothing is expanded yet
      if (sortedClusters.length > 1 && prev.size === 0) {
        return new Set([sortedClusters[0]]);
      }
      return prev;
    });
  }, [sortedClusters]);

  const toggleCluster = (clusterName: string): void => {
    setExpandedClusters(prev => {
      // If clicking on an already expanded cluster, collapse it
      if (prev.has(clusterName)) {
        return new Set();
      }
      // Otherwise, expand only this cluster (accordion behavior)
      return new Set([clusterName]);
    });
  };

  const tooltipContent = (): React.ReactNode => {
    const showMeshGrouping = hasMultipleMeshes();
    const hasMultipleClusters = sortedClusters.length > 1;

    const hasFailingComponents = (comps: ComponentStatus[]): boolean => {
      return comps.some(comp => comp.status !== Status.Healthy);
    };

    return (
      <Content>
        <Content className={clusterStatusHeaderStyle}>{t('Cluster Status')}</Content>
        {sortedClusters.map(cl => {
          const components = statusMap[cl] || [];
          const isExpanded = expandedClusters.has(cl);
          const hasFailures = hasFailingComponents(components);

          if (hasMultipleClusters) {
            return (
              <React.Fragment key={cl}>
                <div
                  className={clusterStyle}
                  onClick={hasFailures ? () => toggleCluster(cl) : undefined}
                  style={{ cursor: hasFailures ? 'pointer' : 'default' }}
                >
                  {hasFailures && (
                    <Button
                      variant={ButtonVariant.plain}
                      style={{ padding: 0, marginRight: PFSpacer.xs }}
                      icon={isExpanded ? <KialiIcon.AngleDown /> : <KialiIcon.AngleRight />}
                    />
                  )}
                  <PFBadge badge={PFBadges.Cluster} size="sm" />
                  {cl}
                  {cl === homeCluster?.name && (
                    <span style={{ marginLeft: PFSpacer.xs }}>
                      <KialiIcon.Star />
                    </span>
                  )}
                </div>
                <Divider className={dividerStyle} />
                {isExpanded && renderComponents(components, cl, showMeshGrouping)}
              </React.Fragment>
            );
          }

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
              <Divider className={dividerStyle} />
              {renderComponents(components, cl, showMeshGrouping)}
            </React.Fragment>
          );
        })}
        {!pathname.endsWith('/mesh') && isControlPlaneAccessible() && (
          <div className={meshLinkStyle}>
            <span>{t('More info at')}</span>
            <Link
              to="/mesh"
              onClick={() => {
                // Force tooltip to close by remounting with a new key
                setTooltipKey(prev => prev + 1);
              }}
            >
              {t('Mesh page')}
            </Link>
          </div>
        )}
      </Content>
    );
  };

  const tooltipColor = (): string => {
    let coreUnhealthy = false;
    let addonUnhealthy = false;
    let notReady = false;
    const values = Object.values(statusMap).flat();

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

  const tooltipPosition = TooltipPosition.top;

  let status: 'info' | 'danger' | 'warning' | 'success' | 'custom' | undefined = 'success';
  let dataTest = 'istio-status-success';
  if (!healthyComponents()) {
    const iconColor = tooltipColor();
    status = 'info';
    dataTest = 'istio-status';

    if (iconColor === PFColors.Danger) {
      status = 'danger';
      dataTest = `${dataTest}-danger`;
    } else if (iconColor === PFColors.Warning) {
      status = 'warning';
      dataTest = `${dataTest}-warning`;
    } else if (iconColor === PFColors.Info) {
      status = 'success';
      dataTest = `${dataTest}-info`;
    } else if (iconColor === PFColors.Success) {
      status = 'success';
      dataTest = `${dataTest}-success`;
    }
  }

  return (
    <Tooltip
      key={tooltipKey}
      data-test="component-status-tooltip"
      position={tooltipPosition}
      enableFlip={true}
      content={tooltipContent()}
      className={tooltipStyle}
      maxWidth="25rem"
    >
      <>
        {homeCluster?.name && (
          <Label data-test={dataTest} status={status}>
            {homeCluster?.name}
          </Label>
        )}
      </>
    </Tooltip>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  namespaces: namespaceItemsSelector(state)
});

export const IstioStatus = connect(mapStateToProps)(IstioStatusComponent);
