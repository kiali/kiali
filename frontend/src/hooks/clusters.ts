import * as React from 'react';
import * as API from '../services/Api';
import { ComponentStatus } from '../types/IstioStatus';
import { istioStatusSelector } from '../store/Selectors';
import { IstioStatusActions } from '../actions/IstioStatusActions';
import { useKialiDispatch, useKialiSelector } from './redux';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { MessageType } from '../types/NotificationCenter';
import { useKialiTranslation } from '../utils/I18nUtils';

export type ClusterStatusMap = { [cluster: string]: ComponentStatus[] };

export type ClusterStatusResult = {
  isError: boolean;
  isLoading: boolean;
  refresh: () => void;
  statusMap: ClusterStatusMap;
};

type UseClusterStatusOptions = {
  hasNamespaces?: boolean;
  onRefresh?: () => void;
};

export const useClusterStatus = (options?: UseClusterStatusOptions): ClusterStatusResult => {
  const { t } = useKialiTranslation();
  const dispatch = useKialiDispatch();
  const statusMapFromRedux = useKialiSelector(istioStatusSelector);
  const { lastRefreshAt } = useRefreshInterval();
  const [isError, setIsError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  const hasNamespaces = options?.hasNamespaces ?? true;

  const refresh = React.useCallback((): void => {
    setRefreshIndex(i => i + 1);
  }, []);

  // Use ref to avoid recreating callback when onRefresh changes
  const onRefreshRef = React.useRef(options?.onRefresh);
  React.useEffect(() => {
    onRefreshRef.current = options?.onRefresh;
  }, [options?.onRefresh]);

  React.useEffect(() => {
    let active = true;

    setIsLoading(true);
    setIsError(false);

    API.getIstioStatus()
      .then(response => {
        if (!active) {
          return;
        }

        const statusMap: ClusterStatusMap = {};

        response.data.forEach(status => {
          if (!statusMap[status.cluster]) {
            statusMap[status.cluster] = [];
          }
          statusMap[status.cluster].push(status);
        });

        dispatch(IstioStatusActions.setinfo(statusMap));

        if (onRefreshRef.current) {
          onRefreshRef.current();
        }
      })
      .catch(error => {
        if (!active) {
          return;
        }

        setIsError(true);
        const informative = !hasNamespaces;

        if (informative) {
          addError(t('Istio deployment status disabled.'), error, true, MessageType.INFO);
        } else {
          addError(t('Error fetching Istio deployment status.'), error);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [dispatch, hasNamespaces, lastRefreshAt, refreshIndex, t]);

  return {
    isError,
    isLoading,
    refresh,
    statusMap: statusMapFromRedux
  };
};
