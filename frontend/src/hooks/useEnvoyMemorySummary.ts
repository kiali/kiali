import * as React from 'react';
import type { Workload } from 'types/Workload';
import type { EnvoyMemorySummary } from 'types/EnvoyMemory';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import { addError } from 'utils/AlertUtils';
import { buildEnvoyMemoryQueryParams, fetchEnvoyMemorySummary } from 'utils/EnvoyMemoryUtils';

export const useEnvoyMemorySummary = (
  namespace: string,
  workload: Workload,
  timeRange: TimeRange,
  lastRefreshAt: TimeInMilliseconds,
  enabled: boolean
): { summary?: EnvoyMemorySummary } => {
  const [summary, setSummary] = React.useState<EnvoyMemorySummary>();

  const loadSummary = React.useCallback((): void => {
    fetchEnvoyMemorySummary(
      namespace,
      workload.name,
      buildEnvoyMemoryQueryParams(timeRange, lastRefreshAt),
      workload.cluster
    )
      .then(data => {
        setSummary(data);
      })
      .catch(error => {
        addError('Could not fetch Envoy memory summary.', error);
      });
  }, [lastRefreshAt, namespace, timeRange, workload.cluster, workload.name]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    loadSummary();
  }, [enabled, loadSummary]);

  return { summary: enabled ? summary : undefined };
};
