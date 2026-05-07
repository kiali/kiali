import { serverConfig } from 'config';
import { NamespaceAction } from 'pages/Namespaces/NamespaceActions';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { ControlPlane } from 'types/Mesh';
import { ExternalLink } from 'types/Dashboards';
import { gvkType } from 'types/IstioConfigList';
import { getGVKTypeString } from 'utils/IstioConfigUtils';
import { t } from 'utils/I18nUtils';

export type NamespaceRowActionsParams = {
  controlPlanes: ControlPlane[] | undefined;
  grafanaLinks: ExternalLink[];
  istioAPIEnabled: boolean;
  nsInfo: NamespaceInfo;
  onOpenTrafficPoliciesModal: (p: { clusterTarget?: string; kind: string; nsTarget: string; opTarget: string }) => void;
  onRefreshAfterExternalLink?: () => void;
  persesLinks: ExternalLink[];
};

/**
 * Actions menu entries for the namespace detail page.
 */
const pushSeparator = (actions: NamespaceAction[]): void => {
  if (actions.some(a => !a.isSeparator)) {
    actions.push({ isGroup: false, isSeparator: true });
  }
};

export const buildNamespaceRowActions = (p: NamespaceRowActionsParams): NamespaceAction[] => {
  const { nsInfo } = p;
  const namespaceActions: NamespaceAction[] = [];
  const viewOnly = serverConfig.deployment.viewOnlyMode;

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
      pushSeparator(namespaceActions);

      const enableAction = {
        'data-test': `enable-${nsInfo.name}-namespace-sidecar-injection`,
        isDisabled: viewOnly,
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
        isDisabled: viewOnly,
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
        isDisabled: viewOnly,
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
        isDisabled: viewOnly,
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
        isDisabled: viewOnly,
        isGroup: false,
        isSeparator: false,
        title: t('Disable Ambient'),
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
        isDisabled: viewOnly,
        isGroup: false,
        isSeparator: false,
        title: t('Remove Ambient'),
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
          pushSeparator(namespaceActions);
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
          isDisabled: viewOnly,
          isGroup: false,
          isSeparator: false,
          title: t('Switch to {{revision}} revision', { revision: controlPlane.revision }),
          action: (ns: string) =>
            p.onOpenTrafficPoliciesModal({
              opTarget: controlPlane.revision,
              kind: 'canary',
              nsTarget: ns,
              clusterTarget: nsInfo.cluster
            })
        }));

      if (revisionActions && revisionActions.length > 0) {
        pushSeparator(namespaceActions);
      }

      revisionActions?.forEach(action => {
        namespaceActions.push(action);
      });
    }

    const aps = nsInfo.istioConfig?.resources[getGVKTypeString(gvkType.AuthorizationPolicy)] ?? [];

    const addAuthorizationAction = {
      isDisabled: viewOnly,
      isGroup: false,
      isSeparator: false,
      title: aps.length === 0 ? t('Create Traffic Policies') : t('Update Traffic Policies'),
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
      isDisabled: viewOnly,
      isGroup: false,
      isSeparator: false,
      title: t('Delete Traffic Policies'),
      action: (ns: string) =>
        p.onOpenTrafficPoliciesModal({
          opTarget: 'delete',
          nsTarget: ns,
          clusterTarget: nsInfo.cluster,
          kind: 'policy'
        })
    };

    if (p.istioAPIEnabled) {
      pushSeparator(namespaceActions);

      namespaceActions.push(addAuthorizationAction);

      if (aps.length > 0) {
        namespaceActions.push(removeAuthorizationAction);
      }
    }
  } else {
    if (p.grafanaLinks.length > 0) {
      pushSeparator(namespaceActions);

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
      pushSeparator(namespaceActions);

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
