import { updateState } from '../utils/Reducer';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { MetricsStats } from 'types/Metrics';
import { MetricsStatsActions } from 'actions/MetricsStatsActions';

export type MetricsStatsState = {
  data: Map<string, MetricsStats>;
};

export const INITIAL_METRICS_STATS_STATE: MetricsStatsState = { data: new Map() };

export const MetricsStatsStateReducer = (
  state: MetricsStatsState = INITIAL_METRICS_STATS_STATE,
  action: KialiAppAction
): MetricsStatsState => {
  switch (action.type) {
    case getType(MetricsStatsActions.setStats):
      return updateState(state, { data: action.payload.metricsStats });
    default:
      return state;
  }
};
