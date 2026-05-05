import { buildNamespaceRowActions, NamespaceRowActionsParams } from '../namespaceDetailActions';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { serverConfig } from 'config';

jest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key,
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
});
