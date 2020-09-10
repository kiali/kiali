import { ToleranceConfig } from '../ServerConfig';
import { ThresholdStatus } from '../Health';

/*
Error Ratio for:
  - Global: Inbound and Outbound requests
  - Inbound Requests
  - Outbound Requests
 */
export interface ErrorRatio {
  global: { status: ThresholdStatus; protocol?: string; toleranceConfig?: ToleranceConfig };
  inbound: { status: ThresholdStatus; protocol?: string; toleranceConfig?: ToleranceConfig };
  outbound: { status: ThresholdStatus; protocol?: string; toleranceConfig?: ToleranceConfig };
}

/*
Rate Interface:
- The number of requests in t seconds requested by the user
- The number of requests with error code
- The ratio % of errors
*/

export interface Rate {
  requestRate: number;
  errorRate: number;
  errorRatio: number;
}

/*
RequestTolerance interface
- Tolerance configuration applied
- Requests error rate calculation for the tolerance Configuration where key is the protocol
*/
export interface RequestTolerance {
  tolerance: ToleranceConfig;
  requests: { [key: string]: Rate | number };
}
