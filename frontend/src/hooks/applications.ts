import * as React from 'react';
import * as API from '../services/Api';
import { AppListItemResponse } from '../types/AppList';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { useKialiTranslation } from '../utils/I18nUtils';
import { isMultiCluster, serverConfig } from '../config';

export type ApplicationsResult = {
  applications: AppListItemResponse[];
  isLoading: boolean;
  metrics: {
    latency: string;
    no_traffic: string;
    rps: string;
  };
};

export const useApplications = (): ApplicationsResult => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const [isLoading, setIsLoading] = React.useState(false);
  const [applications, setApplications] = React.useState<AppListItemResponse[]>([]);
  const [metrics, setMetrics] = React.useState<{ latency: string; no_traffic: string; rps: string }>({
    latency: '',
    no_traffic: '',
    rps: ''
  });

  const fetchApplications = React.useCallback((): void => {
    setIsLoading(true);
    const fetchPromises: Promise<AppListItemResponse[]>[] = [];

    if (isMultiCluster) {
      for (let cluster in serverConfig.clusters) {
        fetchPromises.push(
          API.getClusterApps('', { health: 'true', istioResources: 'false', metrics: 'true' }, cluster).then(
            response => response.data.applications
          )
        );
      }
    } else {
      fetchPromises.push(
        API.getClusterApps('', { health: 'true', istioResources: 'false', metrics: 'true' }, undefined).then(
          response => response.data.applications
        )
      );
    }

    Promise.all(fetchPromises)
      .then(results => {
        const apps = results.flat();
        setApplications(apps);

        const rpsValues = apps
          .map(app => Number.parseFloat(app.metrics?.request_rate_total ?? ''))
          .filter(value => Number.isFinite(value));
        const rpsSum = rpsValues.reduce((acc, value) => acc + value, 0);
        const rpsFormatted =
          rpsValues.length === 0 ? '' : rpsSum >= 1000 ? `${(rpsSum / 1000).toFixed(1)}K` : rpsSum.toFixed(1);

        const latencyValues = apps
          .map(app => Number.parseFloat(app.metrics?.request_latency_p50_ms ?? ''))
          .filter(value => Number.isFinite(value));
        const latencyAvg =
          latencyValues.length > 0 ? latencyValues.reduce((acc, value) => acc + value, 0) / latencyValues.length : 0;
        const noTrafficCount = apps.filter(app => {
          const value = Number.parseFloat(app.metrics?.request_rate_total ?? '');
          return !Number.isFinite(value) || value <= 0;
        }).length;

        setMetrics({
          latency: latencyValues.length > 0 ? latencyAvg.toFixed(2) : '',
          no_traffic: String(noTrafficCount),
          rps: rpsFormatted
        });
      })
      .catch(error => {
        addError(t('Error fetching Applications.'), error);
        setApplications([]);
        setMetrics({ latency: '', rps: '', no_traffic: '' });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [t]);

  React.useEffect(() => {
    fetchApplications();
  }, [lastRefreshAt, fetchApplications]);

  return {
    applications,
    isLoading,
    metrics
  };
};
