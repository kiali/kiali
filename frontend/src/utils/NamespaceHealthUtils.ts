import { DEGRADED, FAILURE, HEALTHY, NA, NOT_READY, Status, Health, NamespaceHealth } from 'types/Health';
import { NamespaceStatus } from 'types/NamespaceInfo';

type HealthMap = Record<string, Health> | undefined;

const namespaceStatusFromHealthMap = (healthMap: HealthMap): NamespaceStatus | undefined => {
  if (!healthMap || Object.keys(healthMap).length === 0) {
    return undefined;
  }

  const nsStatus: NamespaceStatus = {
    inError: [],
    inNotReady: [],
    inSuccess: [],
    inWarning: [],
    notAvailable: []
  };

  Object.keys(healthMap).forEach(k => {
    const health = healthMap[k];
    if (!health) {
      return;
    }

    const status = health.getStatus();
    if (status === FAILURE) {
      nsStatus.inError.push(k);
    } else if (status === DEGRADED) {
      nsStatus.inWarning.push(k);
    } else if (status === HEALTHY) {
      nsStatus.inSuccess.push(k);
    } else if (status === NOT_READY) {
      nsStatus.inNotReady.push(k);
    } else {
      nsStatus.notAvailable.push(k);
    }
  });

  return nsStatus;
};

export const namespaceStatusesFromNamespaceHealth = (
  nsHealth: NamespaceHealth
): { statusApp?: NamespaceStatus; statusService?: NamespaceStatus; statusWorkload?: NamespaceStatus } => {
  return {
    statusApp: namespaceStatusFromHealthMap((nsHealth.appHealth as unknown) as Record<string, Health>),
    statusService: namespaceStatusFromHealthMap((nsHealth.serviceHealth as unknown) as Record<string, Health>),
    statusWorkload: namespaceStatusFromHealthMap((nsHealth.workloadHealth as unknown) as Record<string, Health>)
  };
};

// Worst status across app/service/workload. Matches the Namespaces page "Health" column logic.
export const combinedWorstStatus = (
  statusApp?: NamespaceStatus,
  statusService?: NamespaceStatus,
  statusWorkload?: NamespaceStatus
): Status => {
  let worstStatus = NA;
  let worstPriority = 5; // Lower number = worse status

  const statuses = [statusApp, statusService, statusWorkload];
  statuses.forEach(status => {
    if (status) {
      if (status.inError.length > 0 && worstPriority > 1) {
        worstStatus = FAILURE;
        worstPriority = 1;
      } else if (status.inWarning.length > 0 && worstPriority > 2) {
        worstStatus = DEGRADED;
        worstPriority = 2;
      } else if (status.inNotReady.length > 0 && worstPriority > 3) {
        worstStatus = NOT_READY;
        worstPriority = 3;
      } else if (status.inSuccess.length > 0 && worstPriority > 4) {
        worstStatus = HEALTHY;
        worstPriority = 4;
      } else if (status.notAvailable.length > 0 && worstPriority > 5) {
        worstStatus = NA;
        worstPriority = 5;
      }
    }
  });

  return worstStatus;
};
