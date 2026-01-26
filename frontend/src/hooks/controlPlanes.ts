import * as React from 'react';
import * as API from '../services/Api';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { useKialiTranslation } from '../utils/I18nUtils';
import { ControlPlane } from '../types/Mesh';

export type ControlPlanesResult = {
  controlPlanes: ControlPlane[];
  isLoading: boolean;
};

export const useControlPlanes = (): ControlPlanesResult => {
  const { t } = useKialiTranslation();
  const { lastRefreshAt } = useRefreshInterval();
  const [isLoading, setIsLoading] = React.useState(false);
  const [controlPlanes, setControlPlanes] = React.useState<ControlPlane[]>([]);

  const fetchControlPlanes = React.useCallback((): void => {
    setIsLoading(true);

    API.getControlPlanes()
      .then(response => {
        setControlPlanes(response.data);
      })
      .catch(error => {
        addError(t('Error fetching control planes.'), error);
        setControlPlanes([]);
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
    isLoading
  };
};
