import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../store/Store';
import { KialiAppAction } from './KialiAppAction';
import * as API from '../services/Api';
import { MetricsStatsActions } from './MetricsStatsActions';
import { MetricsStatsQuery, statsQueryToKey } from 'types/MetricsOptions';
import { addError, addInfo } from 'utils/AlertUtils';
import { MetricsStats } from 'types/Metrics';

type ExpiringStats = MetricsStats & { timestamp: number };

const expiry = 2 * 60 * 1000;
const MetricsStatsThunkActions = {
  load: (queries: MetricsStatsQuery[]) => {
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>, getState: () => KialiAppState) => {
      const oldStats = getState().metricsStats.data as Map<string, ExpiringStats>;
      const now = Date.now();
      // Keep only queries for stats we don't already have
      const newStats = new Map(Array.from(oldStats).filter(([_, v]) => now - v.timestamp < expiry));
      const filtered = queries.filter(q => !newStats.has(statsQueryToKey(q)));
      if (filtered.length > 0) {
        API.getMetricsStats(filtered)
          .then(res => {
            // Merge result
            Object.entries(res.data.stats).forEach(e => newStats.set(e[0], { ...e[1], timestamp: now }));
            dispatch(MetricsStatsActions.setStats(newStats));
            if (res.data.warnings && res.data.warnings.length > 0) {
              addInfo(res.data.warnings.join('; '), false);
            }
          })
          .catch(err => {
            addError('Could not fetch metrics stats.', err);
          });
      }
    };
  }
};

export default MetricsStatsThunkActions;
