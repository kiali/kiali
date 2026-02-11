import * as React from 'react';
import { useKialiTranslation } from 'utils/I18nUtils';
import { addDanger } from 'utils/AlertUtils';
import * as API from 'services/Api';
import { ApiError } from 'types/Api';
import { Namespace } from 'types/Namespace';
import { DurationInSeconds } from 'types/Common';
import { DEGRADED, FAILURE, HEALTHY, HealthStatusId, NA, NOT_READY } from 'types/Health';
import { fetchClusterNamespacesHealth } from 'services/NamespaceHealth';
import { combinedWorstStatus, isDataPlaneNamespace, namespaceStatusesFromNamespaceHealth } from 'utils/NamespaceUtils';

type NamespaceWithHealthStatus = Namespace & { healthStatus: HealthStatusId };

export type DataPlanesResult = {
  ambient: number;
  healthy: number;
  isError: boolean;
  isLoading: boolean;
  namespacesDegraded: NamespaceWithHealthStatus[];
  namespacesFailure: NamespaceWithHealthStatus[];
  namespacesNA: NamespaceWithHealthStatus[];
  namespacesNotReady: NamespaceWithHealthStatus[];
  refresh: () => void;
  sidecar: number;
  total: number;
};

const emptyResult: Omit<DataPlanesResult, 'isError' | 'isLoading' | 'refresh'> = {
  ambient: 0,
  healthy: 0,
  namespacesDegraded: [],
  namespacesFailure: [],
  namespacesNA: [],
  namespacesNotReady: [],
  sidecar: 0,
  total: 0
};

export const useDataPlanes = (namespaces: Namespace[], duration: DurationInSeconds): DataPlanesResult => {
  const { t } = useKialiTranslation();
  const [isError, setIsError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState(emptyResult);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  const refresh = React.useCallback((): void => {
    setRefreshIndex(i => i + 1);
  }, []);

  const nsKey = React.useCallback((cluster: string | undefined, name: string): string => {
    return `${cluster ?? ''}::${name}`;
  }, []);

  React.useEffect(() => {
    let active = true;

    const fetchDataPlanes = async (): Promise<void> => {
      setIsLoading(true);
      setIsError(false);

      // Overview card is scoped to data-plane namespaces only (ambient or sidecar-injected).
      const dataPlaneNamespaces = namespaces.filter(isDataPlaneNamespace);

      // Calculate ambient/sidecar totals from the namespace list itself (even if health isn't available).
      let ambient = 0;
      let sidecar = 0;
      dataPlaneNamespaces.forEach(ns => {
        if (ns.isAmbient) {
          ambient++;
        } else {
          sidecar++;
        }
      });

      // Default all data-plane namespaces to NA; we will overwrite when health is present.
      const nextHealth: Record<string, HealthStatusId> = {};
      dataPlaneNamespaces.forEach(ns => {
        nextHealth[nsKey(ns.cluster, ns.name)] = NA.id as HealthStatusId;
      });

      if (dataPlaneNamespaces.length > 0) {
        // Group namespaces by cluster (undefined cluster => single-cluster mode)
        const namespacesByCluster = new Map<string | undefined, string[]>();
        dataPlaneNamespaces.forEach(ns => {
          const current = namespacesByCluster.get(ns.cluster) || [];
          current.push(ns.name);
          namespacesByCluster.set(ns.cluster, current);
        });

        const clusterResults = await Promise.all(
          Array.from(namespacesByCluster.entries()).map(async ([cluster, nsNames]) => {
            const healthMap = await fetchClusterNamespacesHealth(nsNames, duration, cluster);
            return { cluster, healthMap, nsNames };
          })
        );

        clusterResults.forEach(({ cluster, healthMap, nsNames }) => {
          nsNames.forEach(name => {
            const nsHealth = healthMap.get(name);
            if (!nsHealth) {
              return;
            }

            const statuses = namespaceStatusesFromNamespaceHealth(nsHealth);
            const worst = combinedWorstStatus(statuses.statusApp, statuses.statusService, statuses.statusWorkload);
            nextHealth[nsKey(cluster, name)] = worst.id as HealthStatusId;
          });
        });
      }

      // Bucket namespaces by health status using the computed health map (missing => NA).
      let healthy = 0;
      const namespacesFailure: NamespaceWithHealthStatus[] = [];
      const namespacesDegraded: NamespaceWithHealthStatus[] = [];
      const namespacesNotReady: NamespaceWithHealthStatus[] = [];
      const namespacesNA: NamespaceWithHealthStatus[] = [];

      dataPlaneNamespaces.forEach(ns => {
        const healthStatus = nextHealth[nsKey(ns.cluster, ns.name)];
        if (healthStatus === FAILURE.id) {
          namespacesFailure.push({ ...ns, healthStatus });
        } else if (healthStatus === DEGRADED.id) {
          namespacesDegraded.push({ ...ns, healthStatus });
        } else if (healthStatus === NOT_READY.id) {
          namespacesNotReady.push({ ...ns, healthStatus });
        } else if (healthStatus === HEALTHY.id) {
          healthy++;
        } else {
          namespacesNA.push({ ...ns, healthStatus: NA.id as HealthStatusId });
        }
      });

      if (active) {
        setResult({
          ambient,
          healthy,
          namespacesDegraded,
          namespacesFailure,
          namespacesNA,
          namespacesNotReady,
          sidecar,
          total: ambient + sidecar
        });
      }
    };

    fetchDataPlanes()
      .catch(err => {
        addDanger(t('Could not fetch health'), API.getErrorString(err as ApiError));
        if (active) {
          setIsError(true);
          setResult(emptyResult);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [duration, namespaces, nsKey, refreshIndex, t]);

  return {
    ...result,
    isError,
    isLoading,
    refresh
  };
};
