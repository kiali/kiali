import * as React from 'react';
import * as API from '../services/Api';
import { AppListItemResponse } from '../types/AppList';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { useKialiTranslation } from '../utils/I18nUtils';
import { isMultiCluster, serverConfig } from '../config';
import { useKialiSelector } from './redux';
import { durationSelector } from '../store/Selectors';

export type ApplicationsResult = {
  applications: AppListItemResponse[];
  duration: number;
  isLoading: boolean;
};

export const useApplications = (): ApplicationsResult => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const duration = useKialiSelector(durationSelector);
  const [isLoading, setIsLoading] = React.useState(false);
  const [applications, setApplications] = React.useState<AppListItemResponse[]>([]);

  const fetchApplications = React.useCallback((): void => {
    setIsLoading(true);
    const fetchPromises: Promise<AppListItemResponse[]>[] = [];

    if (isMultiCluster) {
      for (let cluster in serverConfig.clusters) {
        fetchPromises.push(
          API.getClusterApps('', { health: 'true', istioResources: 'false' }, cluster).then(
            response => response.data.applications
          )
        );
      }
    } else {
      fetchPromises.push(
        API.getClusterApps('', { health: 'true', istioResources: 'false' }, undefined).then(
          response => response.data.applications
        )
      );
    }

    Promise.all(fetchPromises)
      .then(results => {
        setApplications(results.flat());
      })
      .catch(error => {
        addError(t('Error fetching Applications.'), error);
        setApplications([]);
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
    duration,
    isLoading
  };
};
