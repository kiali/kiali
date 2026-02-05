import { DEGRADED, FAILURE, HEALTHY, NA, NOT_READY } from 'types/Health';
import { NamespaceStatus } from 'types/NamespaceInfo';

jest.mock('config', () => ({
  serverConfig: {
    istioLabels: {
      injectionLabelName: 'istio-injection',
      injectionLabelRev: 'istio.io/rev'
    }
  }
}));

const { combinedWorstStatus, isDataPlaneNamespace } = require('../NamespaceHealthUtils');

describe('NamespaceHealthUtils', () => {
  const status = (partial: Partial<NamespaceStatus>): NamespaceStatus => ({
    inError: [],
    inNotReady: [],
    inSuccess: [],
    inWarning: [],
    notAvailable: [],
    ...partial
  });

  it('prioritizes Failure over all other statuses', () => {
    const worst = combinedWorstStatus(
      status({ inWarning: ['a'] }),
      status({ inError: ['svc1'] }),
      status({ inSuccess: ['w1'] })
    );
    expect(worst).toBe(FAILURE);
  });

  it('prioritizes Degraded over Not Ready and Healthy when no Failure', () => {
    const worst = combinedWorstStatus(
      status({ inNotReady: ['a'] }),
      status({ inWarning: ['svc1'] }),
      status({ inSuccess: ['w1'] })
    );
    expect(worst).toBe(DEGRADED);
  });

  it('prioritizes Not Ready over Healthy when no Failure/Degraded', () => {
    const worst = combinedWorstStatus(
      status({ inNotReady: ['a'] }),
      status({ inSuccess: ['svc1'] }),
      status({ inSuccess: ['w1'] })
    );
    expect(worst).toBe(NOT_READY);
  });

  it('returns Healthy when only success exists', () => {
    const worst = combinedWorstStatus(status({ inSuccess: ['a'] }), undefined, undefined);
    expect(worst).toBe(HEALTHY);
  });

  it('returns NA when no status is present', () => {
    const worst = combinedWorstStatus(undefined, undefined, undefined);
    expect(worst).toBe(NA);
  });

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
