import type { WorkloadWeight } from './TrafficShifting';

export const rebalanceUnlockedWeights = (workloads: WorkloadWeight[]): void => {
  let maxWeight = 100;
  const nodeId: number[] = [];

  for (let i = 0; i < workloads.length; i++) {
    if (workloads[i].locked && !workloads[i].mirrored) {
      maxWeight -= workloads[i].weight;
    }
  }
  maxWeight = Math.max(0, maxWeight);

  for (let i = 0; i < workloads.length; i++) {
    if (!workloads[i].locked && !workloads[i].mirrored) {
      nodeId.push(i);
    }
  }

  let sumWeights = 0;
  for (let j = 0; j < nodeId.length; j++) {
    if (sumWeights + workloads[nodeId[j]].weight > maxWeight) {
      workloads[nodeId[j]].weight = Math.max(0, maxWeight - sumWeights);
    }
    sumWeights += workloads[nodeId[j]].weight;
  }

  if (nodeId.length > 0 && sumWeights < maxWeight) {
    workloads[nodeId[nodeId.length - 1]].weight += maxWeight - sumWeights;
  }
};

export const sumNonMirroredWeights = (workloads: WorkloadWeight[]): number =>
  workloads.filter(w => !w.mirrored).reduce((sum, w) => sum + w.weight, 0);
