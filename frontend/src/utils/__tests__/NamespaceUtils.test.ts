jest.mock('config', () => ({
  serverConfig: {
    istioLabels: {
      injectionLabelName: 'istio-injection',
      injectionLabelRev: 'istio.io/rev'
    }
  }
}));

const { isDataPlaneNamespace } = require('../NamespaceUtils');

describe('NamespaceUtils', () => {
  describe('isDataPlaneNamespace', () => {
    it('returns false for control plane namespaces', () => {
      expect(isDataPlaneNamespace({ isControlPlane: true, labels: { 'istio-injection': 'enabled' } })).toBe(false);
    });

    it('returns true for ambient namespaces', () => {
      expect(isDataPlaneNamespace({ isAmbient: true, isControlPlane: false })).toBe(true);
    });

    it('returns true for sidecar injected namespaces', () => {
      expect(isDataPlaneNamespace({ isControlPlane: false, labels: { 'istio-injection': 'enabled' } })).toBe(true);
    });

    it('returns true for revision-labeled namespaces', () => {
      expect(isDataPlaneNamespace({ isControlPlane: false, labels: { 'istio.io/rev': 'rev1' } })).toBe(true);
    });

    it('returns false for namespaces without ambient/injection/revision', () => {
      expect(isDataPlaneNamespace({ isControlPlane: false, labels: {} })).toBe(false);
    });
  });
});
