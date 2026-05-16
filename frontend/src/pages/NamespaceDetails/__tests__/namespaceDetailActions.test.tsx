import { buildNamespaceRowActions, NamespaceRowActionsParams } from '../namespaceDetailActions';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { serverConfig } from 'config';
import { AMBIENT_NAMESPACE_LABEL, AMBIENT_NAMESPACE_LABEL_VALUE } from 'config/ServerConfig';
import { ControlPlane } from 'types/Mesh';

jest.mock('utils/I18nUtils', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    if (opts) {
      return Object.entries(opts).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), key);
    }
    return key;
  },
  tMap: (m: Record<string, string>) => m,
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

const baseNsInfo: NamespaceInfo = {
  name: 'default',
  cluster: 'test-cluster',
  isAmbient: false,
  isControlPlane: false,
  labels: {},
  annotations: {}
};

const controlPlaneNsInfo: NamespaceInfo = {
  name: 'istio-system',
  cluster: 'test-cluster',
  isAmbient: false,
  isControlPlane: true,
  labels: {},
  annotations: {}
};

const baseParams = (
  nsInfo: NamespaceInfo,
  overrides?: Partial<NamespaceRowActionsParams>
): NamespaceRowActionsParams => ({
  controlPlanes: undefined,
  grafanaLinks: [],
  istioAPIEnabled: true,
  nsInfo,
  onOpenTrafficPoliciesModal: jest.fn(),
  persesLinks: [],
  ...overrides
});

const actionTitles = (params: NamespaceRowActionsParams): string[] =>
  buildNamespaceRowActions(params)
    .filter(a => !a.isSeparator)
    .map(a => a.title ?? '');

describe('buildNamespaceRowActions', () => {
  describe('non-control-plane namespace', () => {
    it('includes traffic policy actions when istioAPI is enabled', () => {
      const titles = actionTitles(baseParams(baseNsInfo));
      expect(titles).toContain('Create Traffic Policies');
    });

    it('omits traffic policy actions when istioAPI is disabled', () => {
      const titles = actionTitles(baseParams(baseNsInfo, { istioAPIEnabled: false }));
      expect(titles).not.toContain('Create Traffic Policies');
    });

    it('calls onOpenTrafficPoliciesModal when a policy action is invoked', () => {
      const onOpen = jest.fn();
      const actions = buildNamespaceRowActions(baseParams(baseNsInfo, { onOpenTrafficPoliciesModal: onOpen }));
      const createAction = actions.find(a => a.title?.includes('Traffic Policies') && a.action);
      expect(createAction).toBeDefined();

      createAction!.action!('default');
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({ nsTarget: 'default', kind: 'policy', clusterTarget: 'test-cluster' })
      );
    });
  });

  describe('control-plane namespace', () => {
    it('returns no actions when there are no external links', () => {
      const actions = buildNamespaceRowActions(baseParams(controlPlaneNsInfo));
      const nonSeparators = actions.filter(a => !a.isSeparator);
      expect(nonSeparators).toHaveLength(0);
    });

    it('includes grafana links when provided', () => {
      const titles = actionTitles(
        baseParams(controlPlaneNsInfo, {
          grafanaLinks: [{ name: 'Performance', url: 'http://grafana/perf', variables: {} }]
        })
      );
      expect(titles).toContain('Performance');
    });

    it('includes perses links when provided', () => {
      const titles = actionTitles(
        baseParams(controlPlaneNsInfo, {
          persesLinks: [{ name: 'Istio Mesh', url: 'http://perses/mesh', variables: {} }]
        })
      );
      expect(titles).toContain('Istio Mesh');
    });
  });

  describe('traffic management modal state', () => {
    it('opens the modal with correct params for injection enable', () => {
      const onOpen = jest.fn();
      const actions = buildNamespaceRowActions(baseParams(baseNsInfo, { onOpenTrafficPoliciesModal: onOpen }));

      const enableAction = actions.find(a => a.title === 'Enable Auto Injection');
      if (enableAction?.action) {
        enableAction.action('default');
        expect(onOpen).toHaveBeenCalledWith({
          nsTarget: 'default',
          opTarget: 'enable',
          kind: 'injection',
          clusterTarget: 'test-cluster'
        });
      }
    });
  });

  describe('view-only mode', () => {
    const origViewOnly = serverConfig.deployment.viewOnlyMode;

    afterEach(() => {
      serverConfig.deployment.viewOnlyMode = origViewOnly;
    });

    it('disables all mutating actions when viewOnlyMode is true', () => {
      serverConfig.deployment.viewOnlyMode = true;

      const actions = buildNamespaceRowActions(baseParams(baseNsInfo));
      const mutatingActions = actions.filter(a => !a.isSeparator && a.title);

      expect(mutatingActions.length).toBeGreaterThan(0);
      mutatingActions.forEach(a => {
        expect(a.isDisabled).toBe(true);
      });
    });

    it('does not disable actions when viewOnlyMode is false', () => {
      serverConfig.deployment.viewOnlyMode = false;

      const actions = buildNamespaceRowActions(baseParams(baseNsInfo));
      const mutatingActions = actions.filter(a => !a.isSeparator && a.title);

      expect(mutatingActions.length).toBeGreaterThan(0);
      mutatingActions.forEach(a => {
        expect(a.isDisabled).toBeFalsy();
      });
    });
  });

  describe('ambient namespace actions', () => {
    const origAmbient = serverConfig.ambientEnabled;

    afterEach(() => {
      serverConfig.ambientEnabled = origAmbient;
    });

    it('includes "Add to Ambient" for non-ambient namespace when ambient is enabled', () => {
      serverConfig.ambientEnabled = true;
      const nsInfo: NamespaceInfo = { ...baseNsInfo, isAmbient: false, labels: {} };
      const titles = actionTitles(baseParams(nsInfo));
      expect(titles).toContain('Add to Ambient');
    });

    it('includes disable/remove ambient for ambient namespace', () => {
      serverConfig.ambientEnabled = true;
      const nsInfo: NamespaceInfo = {
        ...baseNsInfo,
        isAmbient: true,
        labels: {
          [AMBIENT_NAMESPACE_LABEL]: AMBIENT_NAMESPACE_LABEL_VALUE
        }
      };
      const titles = actionTitles(baseParams(nsInfo));
      expect(titles).toContain('Disable Ambient');
      expect(titles).toContain('Remove Ambient');
      expect(titles).not.toContain('Add to Ambient');
    });

    it('omits ambient actions when ambientEnabled is false', () => {
      serverConfig.ambientEnabled = false;
      const titles = actionTitles(baseParams(baseNsInfo));
      expect(titles).not.toContain('Add to Ambient');
      expect(titles).not.toContain('Disable Ambient');
    });
  });

  describe('canary upgrade / revision switching', () => {
    const origUpgrade = serverConfig.kialiFeatureFlags.istioUpgradeAction;
    const origInjection = serverConfig.kialiFeatureFlags.istioInjectionAction;

    afterEach(() => {
      serverConfig.kialiFeatureFlags.istioUpgradeAction = origUpgrade;
      serverConfig.kialiFeatureFlags.istioInjectionAction = origInjection;
    });

    it('shows revision switch actions when upgrade action is enabled and control planes differ', () => {
      serverConfig.kialiFeatureFlags.istioUpgradeAction = true;
      serverConfig.kialiFeatureFlags.istioInjectionAction = false;

      const nsInfo: NamespaceInfo = { ...baseNsInfo, revision: '1-20' };
      const controlPlanes: ControlPlane[] = [
        {
          cluster: { name: 'test-cluster' },
          config: {},
          istiodName: 'istiod',
          revision: '1-21',
          managedClusters: [{ name: 'test-cluster' }],
          thresholds: {}
        } as ControlPlane
      ];

      const titles = actionTitles(baseParams(nsInfo, { controlPlanes }));
      expect(titles).toContain('Switch to 1-21 revision');
    });

    it('does not show revision switch when namespace revision matches control plane', () => {
      serverConfig.kialiFeatureFlags.istioUpgradeAction = true;
      serverConfig.kialiFeatureFlags.istioInjectionAction = false;

      const nsInfo: NamespaceInfo = { ...baseNsInfo, revision: '1-20' };
      const controlPlanes: ControlPlane[] = [
        {
          cluster: { name: 'test-cluster' },
          config: {},
          istiodName: 'istiod',
          revision: '1-20',
          managedClusters: [{ name: 'test-cluster' }],
          thresholds: {}
        } as ControlPlane
      ];

      const titles = actionTitles(baseParams(nsInfo, { controlPlanes }));
      expect(titles).not.toContain('Switch to 1-20 revision');
    });

    it('omits revision actions when controlPlanes is undefined', () => {
      serverConfig.kialiFeatureFlags.istioUpgradeAction = true;
      serverConfig.kialiFeatureFlags.istioInjectionAction = false;

      const nsInfo: NamespaceInfo = { ...baseNsInfo, revision: '1-20' };
      const titles = actionTitles(baseParams(nsInfo, { controlPlanes: undefined }));
      const revisionTitles = titles.filter(t => t.includes('revision'));
      expect(revisionTitles).toHaveLength(0);
    });
  });
});
