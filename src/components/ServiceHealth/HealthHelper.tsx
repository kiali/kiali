import { RequestHealth } from '../../types/Health';
import { PfColors } from '../../components/Pf/PfColors';

export interface Status {
  name: string;
  color: string;
  priority: number;
  icon?: string;
  text?: string;
}

// Colors from Patternfly status palette https://www.patternfly.org/styles/color-palette/
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

export const ratioCheck = (valid: number, total: number, issueReporter?: (severity: string) => void): Status => {
  if (total === 0) {
    return NA;
  } else if (valid === 0) {
    if (issueReporter) {
      issueReporter('failure');
    }
    return FAILURE;
  } else if (valid === total) {
    return HEALTHY;
  }
  if (issueReporter) {
    issueReporter('degraded');
  }
  return DEGRADED;
};

export const mergeStatus = (s1: Status, s2: Status): Status => {
  return s1.priority > s2.priority ? s1 : s2;
};

interface Thresholds {
  degraded: number;
  failure: number;
}

const REQUESTS_THRESHOLDS: Thresholds = {
  degraded: 0.001,
  failure: 0.2
};

const ascendingThresholdCheck = (
  value: number,
  thresholds: Thresholds,
  thresholdReporter?: (severity: string, threshold: number, actual: number) => void
): Status => {
  if (value >= thresholds.failure) {
    if (thresholdReporter) {
      thresholdReporter('failure', thresholds.failure, value);
    }
    return FAILURE;
  } else if (value >= thresholds.degraded) {
    if (thresholdReporter) {
      thresholdReporter('degraded', thresholds.degraded, value);
    }
    return DEGRADED;
  }
  return HEALTHY;
};

export type Ratio = number;
const RATIO_NA: Ratio = -1;

export const getRequestRatioText = (ratio: Ratio): string => {
  return ratio === RATIO_NA ? 'No requests' : (100 * ratio).toFixed(2) + '%';
};

export const getRequestErrorsRatio = (rh: RequestHealth): Ratio => {
  if (rh.requestCount === 0) {
    return RATIO_NA;
  }
  return rh.requestErrorCount / rh.requestCount;
};

export const requestErrorsThresholdCheck = (
  ratio: Ratio,
  thresholdReporter?: (severity: string, threshold: number, actual: number) => void
): Status => {
  if (ratio === RATIO_NA) {
    return NA;
  }
  return ascendingThresholdCheck(ratio, REQUESTS_THRESHOLDS, thresholdReporter);
};
