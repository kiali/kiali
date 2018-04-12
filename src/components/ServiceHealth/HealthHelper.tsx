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
  color: '#cc0000',
  priority: 3,
  icon: 'error-circle-o'
};
export const DEGRADED: Status = {
  name: 'Degraded',
  color: '#ec7a08',
  priority: 2,
  icon: 'warning-triangle-o'
};
export const HEALTHY: Status = {
  name: 'Healthy',
  color: '#3f9c35',
  priority: 1,
  icon: 'ok'
};
export const NA: Status = {
  name: 'No health information',
  color: '#707070',
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
