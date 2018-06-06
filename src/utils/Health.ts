import { Health, RequestHealth } from '../types/Health';
import { PfColors } from '../components/Pf/PfColors';

export interface Status {
  name: string;
  color: string;
  priority: number;
  icon?: string;
  text?: string;
}

export const FAILURE: Status = {
  name: 'Failure',
  color: PfColors.Red100,
  priority: 3,
  icon: 'error-circle-o'
};
export const DEGRADED: Status = {
  name: 'Degraded',
  color: PfColors.Orange400,
  priority: 2,
  icon: 'warning-triangle-o'
};
export const HEALTHY: Status = {
  name: 'Healthy',
  color: PfColors.Green400,
  priority: 1,
  icon: 'ok'
};
export const NA: Status = {
  name: 'No health information',
  color: PfColors.Gray,
  priority: 0,
  text: 'N/A'
};

interface Thresholds {
  degraded: number;
  failure: number;
  unit: string;
}

const REQUESTS_THRESHOLDS: Thresholds = {
  degraded: 0.1,
  failure: 20,
  unit: '%'
};

interface ThresholdStatus {
  value: number;
  status: Status;
  violation?: string;
}

// Use -1 rather than NaN to allow straigthforward comparison
const RATIO_NA = -1;

export const ratioCheck = (valid: number, total: number): Status => {
  if (total === 0) {
    return NA;
  } else if (valid === 0) {
    return FAILURE;
  } else if (valid === total) {
    return HEALTHY;
  }
  return DEGRADED;
};

export const mergeStatus = (s1: Status, s2: Status): Status => {
  return s1.priority > s2.priority ? s1 : s2;
};

const ascendingThresholdCheck = (value: number, thresholds: Thresholds): ThresholdStatus => {
  if (value >= thresholds.failure) {
    return {
      value: value,
      status: FAILURE,
      violation: value.toFixed(2) + thresholds.unit + '>=' + thresholds.failure + thresholds.unit
    };
  } else if (value >= thresholds.degraded) {
    return {
      value: value,
      status: DEGRADED,
      violation: value.toFixed(2) + thresholds.unit + '>=' + thresholds.degraded + thresholds.unit
    };
  }
  return { value: value, status: HEALTHY };
};

export const getRequestErrorsRatio = (rh: RequestHealth): ThresholdStatus => {
  if (rh.requestCount === 0) {
    return {
      value: RATIO_NA,
      status: NA
    };
  }
  return ascendingThresholdCheck((100 * rh.requestErrorCount) / rh.requestCount, REQUESTS_THRESHOLDS);
};

export const computeAggregatedHealth = (health?: Health, reporter?: (info: string) => void): Status => {
  let countInactiveDeployments = 0;
  if (health) {
    let statuses: Status[] = [];
    {
      // Envoy
      const envoy = ratioCheck(health.envoy.healthy, health.envoy.total);
      if (reporter && (envoy === FAILURE || envoy === DEGRADED)) {
        reporter('Envoy health ' + envoy.name.toLowerCase());
      }
      statuses.push(envoy);
    }
    {
      // Request errors
      const reqErrorsRatio = getRequestErrorsRatio(health.requests);
      statuses.push(reqErrorsRatio.status);
      if (reporter && reqErrorsRatio.violation) {
        reporter(`Error rate ${reqErrorsRatio.status.name.toLowerCase()}: ${reqErrorsRatio.violation}`);
      }
    }
    {
      // Pods
      statuses = statuses.concat(
        health.deploymentStatuses.map(dep => {
          const status = ratioCheck(dep.available, dep.replicas);
          if (reporter && (status === FAILURE || status === DEGRADED)) {
            reporter('Pod deployment ' + status.name.toLowerCase());
          } else if (status === NA) {
            countInactiveDeployments++;
          }
          return status;
        })
      );
    }

    if (countInactiveDeployments > 0 && countInactiveDeployments === health.deploymentStatuses.length) {
      // No active deployment => special case for failure
      if (reporter) {
        reporter('No active deployment!');
      }
      return FAILURE;
    } else if (reporter && countInactiveDeployments === 1) {
      reporter('One inactive deployment');
    } else if (reporter && countInactiveDeployments > 1) {
      reporter(`${countInactiveDeployments} inactive deployments`);
    }
    // Merge all
    return statuses.reduce(mergeStatus, NA);
  }
  return NA;
};
