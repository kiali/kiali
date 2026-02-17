import * as React from 'react';
import * as API from '../services/Api';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { useKialiTranslation } from '../utils/I18nUtils';

export type AppRateItem = {
  appName: string;
  cluster: string;
  healthStatus: string;
  namespace: string;
  requestRateIn: number;
  requestRateOut: number;
};

export type ApplicationsResult = {
  apps: AppRateItem[];
  isLoading: boolean;
  metrics: {
    no_traffic: string;
    rps: string;
  };
};

export const useApplications = (): ApplicationsResult => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const [isLoading, setIsLoading] = React.useState(false);
  const [apps, setApps] = React.useState<AppRateItem[]>([]);
  const [metrics, setMetrics] = React.useState<{ no_traffic: string; rps: string }>({
    no_traffic: '',
    rps: ''
  });

  const fetchAppRates = React.useCallback((): void => {
    setIsLoading(true);

    API.getOverviewAppRates()
      .then(response => {
        const appRates = response.data.apps ?? [];
        setApps(appRates);

        const rpsSum = appRates.reduce((acc, app) => acc + app.requestRateIn + app.requestRateOut, 0);
        const rpsFormatted =
          appRates.length === 0 ? '' : rpsSum >= 1000 ? `${(rpsSum / 1000).toFixed(1)}K` : rpsSum.toFixed(1);

        const noTrafficCount = appRates.filter(app => app.requestRateIn + app.requestRateOut <= 0).length;

        setMetrics({
          no_traffic: String(noTrafficCount),
          rps: rpsFormatted
        });
      })
      .catch(error => {
        addError(t('Error fetching Applications.'), error);
        setApps([]);
        setMetrics({ rps: '', no_traffic: '' });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [t]);

  React.useEffect(() => {
    fetchAppRates();
  }, [lastRefreshAt, fetchAppRates]);

  return {
    apps,
    isLoading,
    metrics
  };
};
