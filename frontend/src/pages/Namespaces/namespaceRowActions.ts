import { isParentKiosk } from 'components/Kiosk/KioskActions';
import { serverConfig } from 'config';
import { NamespaceAction } from 'pages/Namespaces/NamespaceActions';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { Show } from 'types/Common';
import { IntervalInMilliseconds } from 'types/Common';
import { ControlPlane } from 'types/Mesh';
import { ExternalLink } from 'types/Dashboards';
import { gvkType } from 'types/IstioConfigList';
import { getGVKTypeString } from 'utils/IstioConfigUtils';
import { t } from 'utils/I18nUtils';

export type NamespaceRowActionsParams = {
  controlPlanes: ControlPlane[] | undefined;
  grafanaLinks: ExternalLink[];
  istioAPIEnabled: boolean;
  kiosk: string;
  nsInfo: NamespaceInfo;
  onKioskShow: (showType: Show, namespace: string, refreshInterval: IntervalInMilliseconds) => void;
  onOpenTrafficPoliciesModal: (p: { clusterTarget?: string; kind: string; nsTarget: string; opTarget: string }) => void;
  onRefreshAfterExternalLink?: () => void;
  onShow: (showType: Show, namespace: string) => void;
  persesLinks: ExternalLink[];
  refreshInterval: IntervalInMilliseconds;
};

/**
 * Kebab / Actions menu entries for a namespace row — shared by Namespaces list and Namespace detail.
 */
export const buildNamespaceRowActions = (p: NamespaceRowActionsParams): NamespaceAction[] => {
  const { nsInfo } = p;
  const namespaceActions: NamespaceAction[] = isParentKiosk(p.kiosk)
    ? [
        {
          isGroup: true,
          isSeparator: false,
          isDisabled: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Graph',
              action: (ns: string) => p.onKioskShow(Show.GRAPH, ns, p.refreshInterval)
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Istio Config',
              action: (ns: string) => p.onKioskShow(Show.ISTIO_CONFIG, ns, p.refreshInterval)
            }
          ]
        }
      ]
    : [
        {
          isGroup: true,
          isSeparator: false,
          isDisabled: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Graph',
              action: (ns: string) => p.onShow(Show.GRAPH, ns)
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Applications',
              action: (ns: string) => p.onShow(Show.APPLICATIONS, ns)
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Workloads',
              action: (ns: string) => p.onShow(Show.WORKLOADS, ns)
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Services',
              action: (ns: string) => p.onShow(Show.SERVICES, ns)
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Istio Config',
              action: (ns: string) => p.onShow(Show.ISTIO_CONFIG, ns)
            }
          ]
        }
      ];

  if (!nsInfo.isControlPlane) {
    if (
      !(
        serverConfig.ambientEnabled &&
        nsInfo.labels &&
        nsInfo.labels[serverConfig.istioLabels.ambientNamespaceLabel] ===
          serverConfig.istioLabels.ambientNamespaceLabelValue
      ) &&
      serverConfig.kialiFeatureFlags.istioInjectionAction &&
      !serverConfig.kialiFeatureFlags.istioUpgradeAction
    ) {
      namespaceActions.push({
        isGroup: false,
        isSeparator: true
      });

      const enableAction = {
        'data-test': `enable-${nsInfo.name}-namespace-sidecar-injection`,
        isGroup: false,
        isSeparator: false,
        title: t('Enable Auto Injection'),
        action: (ns: string) =>
          p.onOpenTrafficPoliciesModal({
            nsTarget: ns,
            opTarget: 'enable',
            kind: 'injection',
            clusterTarget: nsInfo.cluster
          })
      };

      const disableAction = {
        'data-test': `disable-${nsInfo.name}-namespace-sidecar-injection`,
        isGroup: false,
        isSeparator: false,
        title: t('Disable Auto Injection'),
        action: (ns: string) =>
          p.onOpenTrafficPoliciesModal({
            nsTarget: ns,
            opTarget: 'disable',
            kind: 'injection',
            clusterTarget: nsInfo.cluster
          })
      };

      const removeAction = {
        'data-test': `remove-${nsInfo.name}-namespace-sidecar-injection`,
        isGroup: false,
        isSeparator: false,
        title: t('Remove Auto Injection'),
        action: (ns: string) =>
          p.onOpenTrafficPoliciesModal({
            nsTarget: ns,
            opTarget: 'remove',
            kind: 'injection',
            clusterTarget: nsInfo.cluster
          })
      };

      if (
        nsInfo.labels &&
        ((nsInfo.labels[serverConfig.istioLabels.injectionLabelName] &&
          nsInfo.labels[serverConfig.istioLabels.injectionLabelName] === 'enabled') ||
          nsInfo.labels[serverConfig.istioLabels.injectionLabelRev])
      ) {
        namespaceActions.push(disableAction);
        namespaceActions.push(removeAction);
      } else if (
        nsInfo.labels &&
        nsInfo.labels[serverConfig.istioLabels.injectionLabelName] &&
        nsInfo.labels[serverConfig.istioLabels.injectionLabelName] === 'disabled'
      ) {
        namespaceActions.push(enableAction);
        namespaceActions.push(removeAction);
      } else {
        namespaceActions.push(enableAction);
      }
    }

    if (serverConfig.ambientEnabled) {
      const addAmbientAction = {
        'data-test': `add-${nsInfo.name}-namespace-ambient`,
        isGroup: false,
        isSeparator: false,
        title: t('Add to Ambient'),
        action: (ns: string) =>
          p.onOpenTrafficPoliciesModal({
            nsTarget: ns,
            opTarget: 'enable',
            kind: 'ambient',
            clusterTarget: nsInfo.cluster
          })
      };

      const disableAmbientAction = {
        'data-test': `disable-${nsInfo.name}-namespace-ambient`,
        isGroup: false,
        isSeparator: false,
        title: 'Disable Ambient',
        action: (ns: string) =>
          p.onOpenTrafficPoliciesModal({
            nsTarget: ns,
            opTarget: 'disable',
            kind: 'ambient',
            clusterTarget: nsInfo.cluster
          })
      };

      const removeAmbientAction = {
        'data-test': `remove-${nsInfo.name}-namespace-ambient`,
        isGroup: false,
        isSeparator: false,
        title: 'Remove Ambient',
        action: (ns: string) =>
          p.onOpenTrafficPoliciesModal({
            nsTarget: ns,
            opTarget: 'remove',
            kind: 'ambient',
            clusterTarget: nsInfo.cluster
          })
      };

      if (
        nsInfo.labels &&
        !nsInfo.labels[serverConfig.istioLabels.injectionLabelName] &&
        !nsInfo.labels[serverConfig.istioLabels.injectionLabelRev]
      ) {
        if (nsInfo.isAmbient) {
          namespaceActions.push({
            isGroup: false,
            isSeparator: true
          });
          namespaceActions.push(disableAmbientAction);
          namespaceActions.push(removeAmbientAction);
        } else {
          namespaceActions.push(addAmbientAction);
        }
      }
    }

    const hasCanaryUpgradeConfigured = p.controlPlanes !== undefined;

    if (serverConfig.kialiFeatureFlags.istioUpgradeAction && hasCanaryUpgradeConfigured) {
      const revisionActions = p.controlPlanes
        ?.filter(
          controlplane =>
            nsInfo.revision &&
            controlplane.managedClusters?.some(managedCluster => managedCluster.name === nsInfo.cluster) &&
            controlplane.revision !== nsInfo.revision
        )
        .map(controlPlane => ({
          isGroup: false,
          isSeparator: false,
          title: `Switch to ${controlPlane.revision} revision`,
          action: (ns: string) =>
            p.onOpenTrafficPoliciesModal({
              opTarget: controlPlane.revision,
              kind: 'canary',
              nsTarget: ns,
              clusterTarget: nsInfo.cluster
            })
        }));

      if (revisionActions && revisionActions.length > 0) {
        namespaceActions.push({
          isGroup: false,
          isSeparator: true
        });
      }

      revisionActions?.forEach(action => {
        namespaceActions.push(action);
      });
    }

    const aps = nsInfo.istioConfig?.resources[getGVKTypeString(gvkType.AuthorizationPolicy)] ?? [];

    const addAuthorizationAction = {
      isGroup: false,
      isSeparator: false,
      title: `${aps.length === 0 ? 'Create ' : 'Update'} Traffic Policies`,
      action: (ns: string) => {
        p.onOpenTrafficPoliciesModal({
          opTarget: aps.length === 0 ? 'create' : 'update',
          nsTarget: ns,
          clusterTarget: nsInfo.cluster,
          kind: 'policy'
        });
      }
    };

    const removeAuthorizationAction = {
      isGroup: false,
      isSeparator: false,
      title: 'Delete Traffic Policies',
      action: (ns: string) =>
        p.onOpenTrafficPoliciesModal({
          opTarget: 'delete',
          nsTarget: ns,
          clusterTarget: nsInfo.cluster,
          kind: 'policy'
        })
    };

    if (p.istioAPIEnabled) {
      namespaceActions.push({
        isGroup: false,
        isSeparator: true
      });

      namespaceActions.push(addAuthorizationAction);

      if (aps.length > 0) {
        namespaceActions.push(removeAuthorizationAction);
      }
    }
  } else {
    if (p.grafanaLinks.length > 0) {
      namespaceActions.push({
        isGroup: false,
        isSeparator: true
      });

      p.grafanaLinks.forEach(link => {
        const grafanaDashboard = {
          isGroup: false,
          isSeparator: false,
          isExternal: true,
          title: link.name,
          action: (_ns: string) => {
            window.open(link.url, '_blank', 'noopener,noreferrer');
            p.onRefreshAfterExternalLink?.();
          }
        };

        namespaceActions.push(grafanaDashboard);
      });
    }
    if (p.persesLinks.length > 0) {
      namespaceActions.push({
        isGroup: false,
        isSeparator: true
      });

      p.persesLinks.forEach(link => {
        const persesDashboard = {
          isGroup: false,
          isSeparator: false,
          isExternal: true,
          title: link.name,
          action: (_ns: string) => {
            window.open(link.url, '_blank', 'noopener,noreferrer');
            p.onRefreshAfterExternalLink?.();
          }
        };

        namespaceActions.push(persesDashboard);
      });
    }
  }

  return namespaceActions;
};
