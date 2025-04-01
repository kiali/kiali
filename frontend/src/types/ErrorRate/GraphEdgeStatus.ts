import { ToleranceConfig } from '../ServerConfig';
import { ascendingThresholdCheck, ThresholdStatus, RATIO_NA, HEALTHY, NA, RequestType } from '../Health';
import { DecoratedGraphEdgeData, DecoratedGraphNodeData, Responses } from '../Graph';
import { aggregate, checkExpr, getRateHealthConfig, transformEdgeResponses } from './utils';
import { RequestTolerance } from './types';
import { RateHealth } from '../HealthAnnotation';

/*
 Return the status for the edge from source to target
*/
export const getEdgeHealth = (
  edge: DecoratedGraphEdgeData,
  source: DecoratedGraphNodeData,
  target: DecoratedGraphNodeData
): ThresholdStatus => {
  // We need to check the configuration for item A outbound requests and configuration of B for inbound requests
  const annotationSource = source.hasHealthConfig ? new RateHealth(source.hasHealthConfig) : undefined;
  const configSource =
    annotationSource && annotationSource.toleranceConfig
      ? annotationSource.toleranceConfig
      : getRateHealthConfig(source.namespace, source[source.nodeType], source.nodeType).tolerance;
  const annotationTarget = target.hasHealthConfig ? new RateHealth(target.hasHealthConfig) : undefined;
  const configTarget =
    annotationTarget && annotationTarget.toleranceConfig
      ? annotationTarget.toleranceConfig
      : getRateHealthConfig(target.namespace, target[target.nodeType], target.nodeType).tolerance;

  // If there is not tolerances with this configuration we'll use defaults
  const tolerancesSource = configSource.filter(tol => checkExpr(tol.direction, 'outbound'));
  const tolerancesTarget = configTarget.filter(tol => checkExpr(tol.direction, 'inbound'));

  // Calculate aggregate
  const outboundEdge = aggregate(transformEdgeResponses(edge.responses, edge.protocol), tolerancesSource, true);
  const inboundEdge = aggregate(transformEdgeResponses(edge.responses, edge.protocol), tolerancesTarget, true);

  // Calculate status
  const outboundEdgeStatus = calculateStatusGraph(outboundEdge, edge.responses);
  const inboundEdgeStatus = calculateStatusGraph(inboundEdge, edge.responses);

  // Keep status with more priority
  return outboundEdgeStatus.status.status.priority > inboundEdgeStatus.status.status.priority
    ? outboundEdgeStatus.status
    : inboundEdgeStatus.status;
};

/*
  Calculate the RequestToleranceGraph for a requests and a configuration
  Return the calculation in the object RequestToleranceGraph
*/

export const generateRateForGraphTolerance = (tol: RequestTolerance, requests: RequestType) => {
  // If we have a tolerance configuration then calculate
  if (tol.tolerance) {
    // For each requests type {<protocol:string> : { <code: string>: <rate: number> } }
    for (let [protocol, req] of Object.entries(requests)) {
      // Check if protocol configuration match the protocol request
      if (checkExpr(tol!.tolerance!.protocol, protocol)) {
        // Loop by the status code and rate for each code
        for (let [code, value] of Object.entries(req)) {
          // If code match the regular expression in the configuration then sum the rate
          if (checkExpr(tol!.tolerance!.code, code)) {
            tol.requests[protocol] = tol.requests[protocol] ? (tol.requests[protocol] as number) + value : value;
          }
        }
      }
    }
  }
};
/*
Calculate the status of the edge with more priority given the results in requestsTolerances: RequestToleranceGraph[]

Return an object with the status calculated, the protocol and the tolerance configuration that kiali applied
 */
export const calculateStatusGraph = (
  requestsTolerances: RequestTolerance[],
  traffic: Responses
): { status: ThresholdStatus; protocol: string; toleranceConfig?: ToleranceConfig } => {
  // By default the health is NA
  let result: { status: ThresholdStatus; protocol: string; toleranceConfig?: ToleranceConfig } = {
    status: {
      value: RATIO_NA,
      status: NA
    },
    protocol: '',
    toleranceConfig: undefined
  };
  // For each calculate errorRate by tolerance configuration
  for (let reqTol of Object.values(requestsTolerances)) {
    for (let [protocol, rate] of Object.entries(reqTol.requests)) {
      const tolerance =
        reqTol.tolerance && checkExpr(reqTol!.tolerance!.protocol, protocol) ? reqTol.tolerance : undefined;
      // Create threshold for the tolerance
      let thresholds = {
        degraded: tolerance!.degraded,
        failure: tolerance!.failure,
        unit: '%'
      };
      // Calculate the status
      const errRatio = (rate as number) / getTotalRequest(traffic);
      const auxStatus = ascendingThresholdCheck(100 * errRatio, thresholds);
      // Check if the status has more priority than the previous one
      if (auxStatus.status.priority > result.status.status.priority) {
        result.status = auxStatus;
        result.protocol = protocol;
        result.toleranceConfig = reqTol.tolerance;
      }
    }
  }
  if (result.status.status === NA && Object.keys(traffic).length > 0) {
    result.status.status = HEALTHY;
    result.status.value = 0;
  }
  return result;
};

export const getTotalRequest = (traffic: Responses): number => {
  var reqRate = 0;
  Object.values(traffic).forEach(item => {
    Object.values(item.flags).forEach(v => (reqRate += Number(v)));
  });
  return reqRate;
};
