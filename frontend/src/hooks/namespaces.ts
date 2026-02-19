import * as React from 'react';
import * as API from '../services/Api';
import { Namespace } from '../types/Namespace';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { useKialiTranslation } from '../utils/I18nUtils';

export type NamespacesResult = {
  isError: boolean;
  isLoading: boolean;
  namespaces: Namespace[];
  refresh: () => void;
};

export const useNamespaces = (): NamespacesResult => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const [isError, setIsError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [namespaces, setNamespaces] = React.useState<Namespace[]>([]);

  const fetchNamespaces = React.useCallback((): void => {
    setIsLoading(true);
    setIsError(false);

    API.getNamespaces()
      .then(response => {
        setNamespaces(response.data);
      })
      .catch(error => {
        addError(t('Error fetching namespaces.'), error);
        setNamespaces([]);
        setIsError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [t]);

  React.useEffect(() => {
    // Fetch on mount and when refresh interval triggers
    fetchNamespaces();
  }, [lastRefreshAt, fetchNamespaces]);

  return {
    isError,
    isLoading,
    namespaces,
    refresh: fetchNamespaces
  };
};
