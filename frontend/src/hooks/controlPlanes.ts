import * as React from 'react';
import * as API from '../services/Api';
import { Status } from '../types/IstioStatus';
import { istioStatusSelector } from '../store/Selectors';
import { useKialiSelector } from './redux';
import { useRefreshInterval } from './refresh';
import { addError } from '../utils/AlertUtils';
import { useKialiTranslation } from '../utils/I18nUtils';
import { ControlPlane } from '../types/Mesh';

export type ControlPlaneStats = {
  healthy: number;
  isLoading: boolean;
  total: number;
  unhealthy: number;
};

export const useControlPlaneStatus = (): ControlPlaneStats => {
  const { t } = useKialiTranslation();
  const statusMapFromRedux = useKialiSelector(istioStatusSelector);
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

  // Calculate health based on IstioStatus data
  const total = controlPlanes.length;
  let healthy = 0;
  let unhealthy = 0;

  controlPlanes.forEach(cp => {
    const cluster = cp.cluster.name;
    const components = statusMapFromRedux[cluster];

    if (components) {
      // Check if all istiod components in this cluster are healthy
      const istiodComponents = components.filter(c => c.name.startsWith('istiod'));
      const isHealthy = istiodComponents.every(c => c.status === Status.Healthy);

      if (isHealthy) {
        healthy++;
      } else {
        unhealthy++;
      }
    } else {
      // No status data - assume healthy
      healthy++;
    }
  });

  return {
    healthy,
    isLoading,
    total,
    unhealthy
  };
};
