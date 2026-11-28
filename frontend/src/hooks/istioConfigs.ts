import * as React from 'react';
import * as API from '../services/Api';
import { ValidationTypes } from '../types/IstioObjects';
import type { IstioConfigItem } from '../types/IstioConfigList';
import { toIstioItems } from '../types/IstioConfigList';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { MessageType } from '../types/NotificationCenter';
import { useKialiTranslation } from '../utils/I18nUtils';
import { isMultiCluster, serverConfig } from '../config';

export enum IstioConfigStatusLabel {
  Warning = 'Warning',
  NotValid = 'Not Valid',
  NotValidated = 'Not Validated'
}

export type IstioConfigIssue = {
  apiVersion: string;
  cluster?: string;
  kind: string;
  name: string;
  namespace: string;
  severity: 'error' | 'warning';
  status: IstioConfigStatusLabel;
};

export type IstioConfigStats = {
  errors: number;
  isError: boolean;
  isLoading: boolean;
  issues: IstioConfigIssue[];
  refresh: () => void;
  total: number;
  valid: number;
  warnings: number;
};

export const useIstioConfigStatus = (): IstioConfigStats => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [stats, setStats] = React.useState<Omit<IstioConfigStats, 'isError' | 'isLoading' | 'refresh'>>({
    errors: 0,
    issues: [],
    total: 0,
    valid: 0,
    warnings: 0
  });

  const fetchIstioConfigs = React.useCallback((): void => {
    setIsLoading(true);
    setIsError(false);

    const fetchPromises: Promise<IstioConfigItem[] | null>[] = [];

    if (isMultiCluster) {
      // Fetch from all clusters
      for (const cluster in serverConfig.clusters) {
        fetchPromises.push(
          API.getAllIstioConfigs([], true, '', '', cluster)
            .then(response => toIstioItems(response.data, cluster))
            .catch(error => {
              // One cluster's failure (e.g. a partially-revoked namespace) must degrade
              // the card to that cluster's configs, not blank it: surface it as a toast
              // and let the other clusters' results render.
              addError(t('Error fetching Istio configs.'), error, true, MessageType.WARNING);
              return null;
            })
        );
      }
    } else {
      fetchPromises.push(
        API.getAllIstioConfigs([], true, '', '', undefined).then(response => toIstioItems(response.data))
      );
    }

    Promise.all(fetchPromises)
      .then(results => {
        // Flatten all items from all clusters, skipping any cluster that failed
        const allItems = results.flatMap(result => result ?? []);

        // Only when every cluster failed is there nothing to show: report an error
        // state rather than pass a legitimately empty mesh off as zero configs.
        if (results.some(result => result === null) && allItems.length === 0) {
          setIsError(true);
          setStats({
            errors: 0,
            issues: [],
            total: 0,
            valid: 0,
            warnings: 0
          });
          return;
        }

        const total = allItems.length;
        let valid = 0;
        let warnings = 0; // Warning + Not Validated
        let errors = 0; // Not Valid
        const issues: IstioConfigIssue[] = [];

        allItems.forEach(item => {
          // Align with Istio list filters:
          // - Not Valid: validation exists AND valid == false
          // - Warning: validation exists AND checks include at least one warning
          // - Not Validated: no validation present
          if (!item.validation) {
            warnings++;
            issues.push({
              apiVersion: item.apiVersion,
              cluster: item.cluster,
              kind: item.kind,
              name: item.name,
              namespace: item.namespace,
              severity: 'warning',
              status: IstioConfigStatusLabel.NotValidated
            });
            return;
          }

          if (!item.validation.valid) {
            errors++;
            issues.push({
              apiVersion: item.apiVersion,
              cluster: item.cluster,
              kind: item.kind,
              name: item.name,
              namespace: item.namespace,
              severity: 'error',
              status: IstioConfigStatusLabel.NotValid
            });
            return;
          }

          const hasWarnings =
            item.validation.checks?.some(check => check.severity === ValidationTypes.Warning) ?? false;
          if (hasWarnings) {
            warnings++;
            issues.push({
              apiVersion: item.apiVersion,
              cluster: item.cluster,
              kind: item.kind,
              name: item.name,
              namespace: item.namespace,
              severity: 'warning',
              status: IstioConfigStatusLabel.Warning
            });
            return;
          }

          valid++;
        });

        setStats({
          errors,
          issues,
          total,
          valid,
          warnings
        });
      })
      .catch(error => {
        addError(t('Error fetching Istio configs.'), error);
        setIsError(true);
        setStats({
          errors: 0,
          issues: [],
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
    isError,
    isLoading,
    refresh: fetchIstioConfigs
  };
};
