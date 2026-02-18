import * as React from 'react';
import * as API from '../services/Api';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { useKialiTranslation } from '../utils/I18nUtils';
import { ControlPlane } from '../types/Mesh';

export type ControlPlanesResult = {
  controlPlanes: ControlPlane[];
  isError: boolean;
  isLoading: boolean;
  refresh: () => void;
};

export const useControlPlanes = (): ControlPlanesResult => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const [isError, setIsError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [controlPlanes, setControlPlanes] = React.useState<ControlPlane[]>([]);

  const fetchControlPlanes = React.useCallback((): void => {
    setIsLoading(true);
    setIsError(false);

    API.getControlPlanes()
      .then(response => {
        setControlPlanes(response.data);
      })
      .catch(error => {
        addError(t('Error fetching control planes.'), error);
        setControlPlanes([]);
        setIsError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [t]);

  React.useEffect(() => {
    // Fetch on mount and when refresh interval triggers
    fetchControlPlanes();
  }, [lastRefreshAt, fetchControlPlanes]);

  return {
    controlPlanes,
    isError,
    refresh: fetchControlPlanes,
    isLoading
  };
};
