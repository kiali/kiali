// Assisted-by: OpenAI Codex
import { URLParam } from 'app/History';
import type { BoundsInMilliseconds } from 'types/Common';
import { GraphType } from 'types/Graph';
import type { HealthHistoryType } from 'services/Api';

export type HealthHistoryRange = Required<BoundsInMilliseconds>;

export const getHealthHistoryRange = (timestamp: number, duration: number, now = Date.now()): HealthHistoryRange => {
  const length = duration * 1000;
  // Match the minute shown by the ribbon tooltip and every destination's custom range.
  const selectedTime = Math.floor(timestamp / 60) * 60000;
  const to = Math.floor(Math.min(selectedTime + length / 2, now) / 60000) * 60000;
  return { from: to - length, to };
};

export const getHealthHistoryGraphUrl = (
  healthType: HealthHistoryType,
  namespace: string,
  name: string,
  cluster: string | undefined,
  range: HealthHistoryRange,
  duration: number
): string => {
  const params = new URLSearchParams();
  params.set(URLParam.NAMESPACES, namespace);
  params.set(URLParam.GRAPH_TYPE, healthType === 'namespace' ? GraphType.WORKLOAD : healthType);
  params.set(URLParam.GRAPH_SERVICE_NODES, 'true');
  params.set(URLParam.GRAPH_REPLAY_ACTIVE, 'true');
  params.set(URLParam.GRAPH_REPLAY_START, String(range.from));
  params.set(URLParam.GRAPH_REPLAY_INTERVAL, String(range.to - range.from));
  params.set(URLParam.DURATION, String(duration));
  if (cluster) {
    params.set(URLParam.CLUSTERNAME, cluster);
  }

  const resources = { app: 'applications', service: 'services', workload: 'workloads' };
  const path =
    healthType === 'namespace'
      ? '/graph/namespaces'
      : `/graph/node/namespaces/${encodeURIComponent(namespace)}/${resources[healthType]}/${encodeURIComponent(name)}`;
  return `${path}?${params.toString()}`;
};
