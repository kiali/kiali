import { ActionType, createAction } from 'typesafe-actions';
import { ActionKeys } from './ActionKeys';
import { MetricsStats } from 'types/Metrics';

export const MetricsStatsActions = {
  setStats: createAction(ActionKeys.METRICS_STATS_SET, resolve => (stats: Map<string, MetricsStats>) =>
    resolve({ metricsStats: stats })
  )
};

export type MetricsStatsAction = ActionType<typeof MetricsStatsActions>;
