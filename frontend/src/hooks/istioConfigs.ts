import * as React from 'react';
import * as API from '../services/Api';
import { ValidationTypes } from '../types/IstioObjects';
import { IstioConfigItem, toIstioItems } from '../types/IstioConfigList';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { useKialiTranslation } from '../utils/I18nUtils';
import { isMultiCluster, serverConfig } from '../config';

export type IstioConfigStats = {
  errors: number;
  isLoading: boolean;
  total: number;
  valid: number;
  warnings: number;
};

export const useIstioConfigStatus = (): IstioConfigStats => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const [isLoading, setIsLoading] = React.useState(false);
  const [stats, setStats] = React.useState<IstioConfigStats>({
    errors: 0,
    isLoading: false,
    total: 0,
    valid: 0,
    warnings: 0
  });

  const fetchIstioConfigs = React.useCallback((): void => {
    setIsLoading(true);

    const fetchPromises: Promise<IstioConfigItem[]>[] = [];

    if (isMultiCluster) {
      // Fetch from all clusters
      for (let cluster in serverConfig.clusters) {
        fetchPromises.push(
          API.getAllIstioConfigs([], true, '', '', cluster).then(response => toIstioItems(response.data, cluster))
        );
      }
    } else {
      fetchPromises.push(
        API.getAllIstioConfigs([], true, '', '', undefined).then(response => toIstioItems(response.data))
      );
    }

    Promise.all(fetchPromises)
      .then(results => {
        // Flatten all items from all clusters
        const allItems = results.flat();

        let total = allItems.length;
        let valid = 0;
        let warnings = 0;
        let errors = 0;

        allItems.forEach(item => {
          if (item.validation) {
            if (item.validation.valid) {
              valid++;
            }

            if (item.validation.checks && item.validation.checks.length > 0) {
              const hasErrors = item.validation.checks.some(check => check.severity === ValidationTypes.Error);
              const hasWarnings = item.validation.checks.some(check => check.severity === ValidationTypes.Warning);

              if (hasErrors) {
                errors++;
              } else if (hasWarnings) {
                warnings++;
              }
            }
          } else {
            // No validation means it's valid
            valid++;
          }
        });

        setStats({
          errors,
          isLoading: false,
          total,
          valid,
          warnings
        });
      })
      .catch(error => {
        addError(t('Error fetching Istio configs.'), error);
        setStats({
          errors: 0,
          isLoading: false,
          total: 0,
          valid: 0,
          warnings: 0
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [t]);

  React.useEffect(() => {
    // Fetch on mount and when refresh interval triggers
    fetchIstioConfigs();
  }, [lastRefreshAt, fetchIstioConfigs]);

  return {
    ...stats,
    isLoading
  };
};
