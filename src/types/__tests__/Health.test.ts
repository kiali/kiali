import * as H from '../Health';

describe('Health', () => {
  it('should check ratio with 0 valid', () => {
    expect(H.ratioCheck(0, 3)).toEqual(H.FAILURE);
  });
  it('should check ratio with some valid', () => {
    expect(H.ratioCheck(1, 3)).toEqual(H.DEGRADED);
  });
  it('should check ratio with all valid', () => {
    expect(H.ratioCheck(3, 3)).toEqual(H.HEALTHY);
  });
  it('should check ratio with no item', () => {
    expect(H.ratioCheck(0, 0)).toEqual(H.NA);
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
    const result = H.getRequestErrorsRatio({ errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 });
    expect(result.status).toEqual(H.NA);
    expect(result.violation).toBeUndefined();
  });
  it('should get healthy requests error ratio', () => {
    const result = H.getRequestErrorsRatio({ errorRatio: 0, inboundErrorRatio: -1, outboundErrorRatio: -1 });
    expect(result.status).toEqual(H.HEALTHY);
    expect(result.value).toEqual(0);
    expect(result.violation).toBeUndefined();
  });
  it('should get degraded requests error ratio', () => {
    const result = H.getRequestErrorsRatio({ errorRatio: 0.1, inboundErrorRatio: -1, outboundErrorRatio: -1 });
    expect(result.status).toEqual(H.DEGRADED);
    expect(result.value).toEqual(10);
    expect(result.violation).toEqual('10.00%>=0.1%');
  });
  it('should get failing requests error ratio', () => {
    const result = H.getRequestErrorsRatio({ errorRatio: 0.5, inboundErrorRatio: -1, outboundErrorRatio: -1 });
    expect(result.status).toEqual(H.FAILURE);
    expect(result.value).toEqual(50);
    expect(result.violation).toEqual('50.00%>=20%');
  });
  it('should calculate error ratio with specified property', () => {
    const result = H.getRequestErrorsRatio(
      { errorRatio: -1, inboundErrorRatio: 0.5, outboundErrorRatio: -1 },
      'inboundErrorRatio'
    );
    expect(result.status).toEqual(H.FAILURE);
    expect(result.value).toEqual(50);
    expect(result.violation).toEqual('50.00%>=20%');
  });
  it('should get comparable error ratio with NA', () => {
    const r1 = H.getRequestErrorsRatio({ errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 });
    const r2 = H.getRequestErrorsRatio({ errorRatio: 0, inboundErrorRatio: 0, outboundErrorRatio: 0 });
    expect(r2.value).toBeGreaterThan(r1.value);
    expect(r1.value).toBeLessThan(r2.value);
  });
  it('should aggregate without reporter', () => {
    const health = new H.AppHealth(
      [{ inbound: { healthy: 0, total: 1 }, outbound: { healthy: 1, total: 1 } }],
      [{ available: 0, replicas: 1, name: 'a' }],
      { errorRatio: 1, inboundErrorRatio: 1, outboundErrorRatio: 1 },
      60
    );
    expect(health.getGlobalStatus()).toEqual(H.FAILURE);
  });
  it('should aggregate healthy', () => {
    const health = new H.AppHealth(
      [{ inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } }],
      [{ available: 1, replicas: 1, name: 'a' }, { available: 2, replicas: 2, name: 'b' }],
      { errorRatio: 0, inboundErrorRatio: 0, outboundErrorRatio: 0 },
      60
    );
    expect(health.getGlobalStatus()).toEqual(H.HEALTHY);
    expect(health.getReport()).toEqual([]);
  });
  it('should aggregate degraded workload', () => {
    const health = new H.AppHealth(
      [{ inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } }],
      [{ available: 1, replicas: 1, name: 'a' }, { available: 1, replicas: 2, name: 'b' }],
      { errorRatio: 0, inboundErrorRatio: 0, outboundErrorRatio: 0 },
      60
    );
    expect(health.getGlobalStatus()).toEqual(H.DEGRADED);
    expect(health.getReport()).toEqual(['Pod workload degraded']);
  });
  it('should aggregate failing envoy', () => {
    const health = new H.AppHealth(
      [{ inbound: { healthy: 0, total: 1 }, outbound: { healthy: 1, total: 1 } }],
      [{ available: 1, replicas: 1, name: 'a' }, { available: 2, replicas: 2, name: 'b' }],
      { errorRatio: 0, inboundErrorRatio: 0, outboundErrorRatio: 0 },
      60
    );
    expect(health.getGlobalStatus()).toEqual(H.FAILURE);
    expect(health.getReport()).toEqual(['Envoy health failure']);
  });
  it('should aggregate failing requests', () => {
    const health = new H.AppHealth(
      [{ inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 1 } }],
      [{ available: 1, replicas: 1, name: 'a' }, { available: 2, replicas: 2, name: 'b' }],
      { errorRatio: 0.2, inboundErrorRatio: 0.3, outboundErrorRatio: 0.1 },
      60
    );
    expect(health.getGlobalStatus()).toEqual(H.FAILURE);
    expect(health.getReport()).toEqual(['Error rate failure: 20.00%>=20%']);
  });
  it('should aggregate multiple issues', () => {
    const health = new H.AppHealth(
      [{ inbound: { healthy: 1, total: 1 }, outbound: { healthy: 1, total: 3 } }],
      [{ available: 0, replicas: 0, name: 'a' }, { available: 0, replicas: 0, name: 'b' }],
      { errorRatio: 0.2, inboundErrorRatio: 0.3, outboundErrorRatio: 0.1 },
      60
    );
    expect(health.getGlobalStatus()).toEqual(H.FAILURE);
    expect(health.getReport()).toEqual([
      'No active workload!',
      'Envoy health degraded',
      'Error rate failure: 20.00%>=20%'
    ]);
  });
});
