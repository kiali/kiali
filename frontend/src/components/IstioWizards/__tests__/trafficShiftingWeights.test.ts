import { rebalanceUnlockedWeights, sumNonMirroredWeights, type WorkloadWeight } from '../TrafficShifting';

const workload = (name: string, weight: number, overrides: Partial<WorkloadWeight> = {}): WorkloadWeight => ({
  locked: false,
  maxWeight: 100,
  mirrored: false,
  name,
  weight,
  ...overrides
});

describe('rebalanceUnlockedWeights', () => {
  it('redistributes among unlocked workloads after a lock', () => {
    const workloads = [workload('a', 60, { locked: true }), workload('b', 50), workload('c', 50)];

    rebalanceUnlockedWeights(workloads);

    expect(sumNonMirroredWeights(workloads)).toBe(100);
    expect(workloads[1].weight + workloads[2].weight).toBe(40);
  });

  it('fills remaining weight to the last unlocked workload', () => {
    const workloads = [workload('a', 70, { locked: true }), workload('b', 10), workload('c', 5)];

    rebalanceUnlockedWeights(workloads);

    expect(sumNonMirroredWeights(workloads)).toBe(100);
    expect(workloads[2].weight).toBe(20);
  });

  it('ignores mirrored workloads in the total', () => {
    const workloads = [workload('a', 50), workload('b', 50), workload('mirror', 100, { mirrored: true })];

    rebalanceUnlockedWeights(workloads);

    expect(sumNonMirroredWeights(workloads)).toBe(100);
  });

  it('does not treat locked mirrored weight as part of the 100 % pool', () => {
    const workloads = [workload('a', 40, { locked: true, mirrored: true }), workload('b', 60)];

    rebalanceUnlockedWeights(workloads);

    expect(workloads[1].maxWeight).toBe(100);
    expect(workloads[1].weight).toBe(100);
    expect(sumNonMirroredWeights(workloads)).toBe(100);
  });
});
