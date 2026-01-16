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
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = React.useState(false);

  const hasNamespaces = options?.hasNamespaces ?? true;

  // Use ref to avoid recreating callback when onRefresh changes
  const onRefreshRef = React.useRef(options?.onRefresh);
  React.useEffect(() => {
    onRefreshRef.current = options?.onRefresh;
  }, [options?.onRefresh]);

  // Fetch and update Redux on mount and refresh
  const fetchStatus = React.useCallback((): void => {
    setIsLoading(true);

    API.getIstioStatus()
      .then(response => {
        const statusMap: ClusterStatusMap = {};

        response.data.forEach(status => {
          if (!statusMap[status.cluster]) {
            statusMap[status.cluster] = [];
          }
          statusMap[status.cluster].push(status);
        });

        // Update Redux so IstioStatus component can use it
        dispatch(IstioStatusActions.setinfo(statusMap));

        if (onRefreshRef.current) {
          onRefreshRef.current();
        }
      })
      .catch(error => {
        // User without namespaces can't have access to mTLS information. Reduce severity to info.
        const informative = !hasNamespaces;

        if (informative) {
          addError(t('Istio deployment status disabled.'), error, true, MessageType.INFO);
        } else {
          addError(t('Error fetching Istio deployment status.'), error);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [dispatch, hasNamespaces, t]);

  React.useEffect(() => {
    // Fetch on mount and when refresh interval triggers
    fetchStatus();
  }, [lastRefreshAt, fetchStatus]);

  return {
    isLoading,
    statusMap: statusMapFromRedux
  };
};
