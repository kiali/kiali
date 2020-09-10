import * as H from '../Health';
import { ToleranceConfig } from '../ServerConfig';
import { setServerConfig } from '../../config/ServerConfig';
import { healthConfig } from '../__testData__/HealthConfig';

const toleranceDefault: ToleranceConfig = {
  code: '',
  failure: 20,
  degraded: 0.1
};

describe('Health', () => {
  beforeAll(() => {
    setServerConfig(healthConfig);
  });
  it('should check ratio with 0 valid', () => {
    expect(H.ratioCheck(0, 3, 3)).toEqual(H.FAILURE);
  });
  it('should check ratio with some valid', () => {
    expect(H.ratioCheck(1, 3, 3)).toEqual(H.DEGRADED);
  });
  it('should check ratio with all valid', () => {
    expect(H.ratioCheck(3, 3, 3)).toEqual(H.HEALTHY);
  });
  it('should check ratio with no item', () => {
    expect(H.ratioCheck(0, 0, 0)).toEqual(H.IDLE);
  });
  it('should check ratio pending Pods', () => {
    // 3 Pods with problems
    expect(H.ratioCheck(3, 6, 3)).toEqual(H.FAILURE);
  });
  it('should merge status with correct priority', () => {
    let status = H.mergeStatus(H.NA, H.HEALTHY);
    expect(status).toEqual(H.HEALTHY);
    status = H.mergeStatus(status, H.DEGRADED);
    expect(status).toEqual(H.DEGRADED);
    status = H.mergeStatus(status, H.FAILURE);
    expect(status).toEqual(H.FAILURE);
    status = H.mergeStatus(status, H.DEGRADED); // commutativity
    expect(status).toEqual(H.FAILURE);
    status = H.mergeStatus(status, H.HEALTHY);
    expect(status).toEqual(H.FAILURE);
    status = H.mergeStatus(status, H.NA);
    expect(status).toEqual(H.FAILURE);
  });
  it('should not get requests error ratio', () => {
    const result = H.getRequestErrorsStatus(-1);
    expect(result.status).toEqual(H.NA);
    expect(result.violation).toBeUndefined();
  });
  it('should get healthy requests error ratio', () => {
    const result = H.getRequestErrorsStatus(0, toleranceDefault);
    expect(result.status).toEqual(H.HEALTHY);
    expect(result.value).toEqual(0);
    expect(result.violation).toBeUndefined();
  });
  it('should get degraded requests error ratio', () => {
    const result = H.getRequestErrorsStatus(0.1, toleranceDefault);
    expect(result.status).toEqual(H.DEGRADED);
    expect(result.value).toEqual(10);
    expect(result.violation).toEqual('10.00%>=0.1%');
  });
  it('should get failing requests error ratio', () => {
    const result = H.getRequestErrorsStatus(0.5, toleranceDefault);
    expect(result.status).toEqual(H.FAILURE);
    expect(result.value).toEqual(50);
    expect(result.violation).toEqual('50.00%>=20%');
  });
  it('should get comparable error ratio with NA', () => {
    const r1 = H.getRequestErrorsStatus(-1, toleranceDefault);
    const r2 = H.getRequestErrorsStatus(0, toleranceDefault);
    expect(r2.value).toBeGreaterThan(r1.value);
    expect(r1.value).toBeLessThan(r2.value);
  });
  it('should aggregate without reporter', () => {
    const health = new H.AppHealth(
      'bookinfo',
      'reviews',
      [{ availableReplicas: 0, currentReplicas: 1, desiredReplicas: 1, name: 'a' }],
      { inbound: { http: { '500': 1 } }, outbound: { http: { '500': 1 } } },
      { rateInterval: 60, hasSidecar: true }
    );
    expect(health.getGlobalStatus()).toEqual(H.FAILURE);
  });
  it('should aggregate healthy', () => {
    const health = new H.AppHealth(
      'bookinfo',
      'reviews',
      [
        { availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, name: 'a' },
        { availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2, name: 'b' }
      ],
      { inbound: {}, outbound: {} },
      { rateInterval: 60, hasSidecar: true }
    );
    expect(health.getGlobalStatus()).toEqual(H.HEALTHY);
  });
  it('should aggregate idle workload', () => {
    const health = new H.AppHealth(
      'bookinfo',
      'reviews',
      [
        { availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, name: 'a' },
        { availableReplicas: 1, currentReplicas: 1, desiredReplicas: 2, name: 'b' }
      ],
      { inbound: {}, outbound: {} },
      { rateInterval: 60, hasSidecar: true }
    );
    expect(health.getGlobalStatus()).toEqual(H.DEGRADED);
  });
  it('should aggregate failing requests', () => {
    const health = new H.AppHealth(
      'bookinfo',
      'reviews',
      [
        { availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, name: 'a' },
        { availableReplicas: 2, currentReplicas: 2, desiredReplicas: 2, name: 'b' }
      ],
      { inbound: { http: { '200': 1.6, '500': 0.3 } }, outbound: { http: { '500': 0.1 } } },
      { rateInterval: 60, hasSidecar: true }
    );
    expect(health.getGlobalStatus()).toEqual(H.FAILURE);
  });
  it('should aggregate multiple issues', () => {
    const health = new H.AppHealth(
      'bookinfo',
      'reviews',
      [
        { availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0, name: 'a' },
        { availableReplicas: 0, currentReplicas: 0, desiredReplicas: 0, name: 'b' }
      ],
      { inbound: { http: { '200': 1.6, '500': 0.3 } }, outbound: { http: { '500': 0.1 } } },
      { rateInterval: 60, hasSidecar: true }
    );
    expect(health.getGlobalStatus()).toEqual(H.FAILURE);
  });
  it('should not ignore error rates when has sidecar', () => {
    const health = new H.AppHealth(
      'bookinfo',
      'reviews',
      [{ availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, name: 'a' }],
      { inbound: {}, outbound: {} },
      { rateInterval: 60, hasSidecar: true }
    );
    expect(health.health.items).toHaveLength(2);
  });
  it('should ignore error rates when no sidecar', () => {
    const health = new H.AppHealth(
      'bookinfo',
      'reviews',
      [{ availableReplicas: 1, currentReplicas: 1, desiredReplicas: 1, name: 'a' }],
      { inbound: {}, outbound: {} },
      { rateInterval: 60, hasSidecar: false }
    );
    expect(health.health.items).toHaveLength(1);
  });
});
