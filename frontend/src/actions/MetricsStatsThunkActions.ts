import { KialiAppState } from '../store/Store';
import * as API from '../services/Api';
import { KialiDispatch } from '../types/Redux';
import { MetricsStatsActions } from './MetricsStatsActions';
import { MetricsStatsQuery, statsQueryToKey } from 'types/MetricsOptions';
import { addError, addInfo } from 'utils/AlertUtils';
import { MetricsStats } from 'types/Metrics';

type ExpiringStats = MetricsStats & { timestamp: number };

const expiry = 2 * 60 * 1000;
export const MetricsStatsThunkActions = {
  load: (queries: MetricsStatsQuery[], isCompact: boolean) => {
    return (dispatch: KialiDispatch, getState: () => KialiAppState) => {
      const oldStats = getState().metricsStats.data as Map<string, ExpiringStats>;
      const now = Date.now();
      // Keep only queries for stats we don't already have, that aren't expired, and are sufficient
      const newStats = new Map(Array.from(oldStats).filter(([_, v]) => now - v.timestamp < expiry));
      const filtered = queries.filter(q => {
        const existingStat = newStats.get(statsQueryToKey(q));
        // perform the query if we don't have the stat, or if we need full stats and only have compact stats
        return !existingStat || (!isCompact && existingStat.isCompact);
      });
      if (filtered.length > 0) {
        return API.getMetricsStats(filtered)
          .then(res => {
            // Merge result
            Object.entries(res.data.stats).forEach(e =>
              newStats.set(e[0], { ...e[1], timestamp: now, isCompact: isCompact })
            );
            dispatch(MetricsStatsActions.setStats(newStats));
            if (res.data.warnings && res.data.warnings.length > 0) {
              addInfo(res.data.warnings.join('; '), false);
            }
          })
          .catch(err => {
            addError('Could not fetch metrics stats.', err);
          });
      } else {
        return Promise.resolve();
      }
    };
  }
};
