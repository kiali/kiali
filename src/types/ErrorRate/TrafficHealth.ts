import { Direction } from '../MetricsOptions';
import { ThresholdStatus } from '../Health';
import { NodeType, ProtocolWithTraffic } from '../Graph';
import { aggregate, checkExpr, getRateHealthConfig, transformEdgeResponses } from './utils';
import { calculateStatusGraph } from './GraphEdgeStatus';
import { TrafficItem } from 'components/TrafficList/TrafficDetails';
import { RateHealth } from '../HealthAnnotation';

/*
 Calculate Health for DetailsTraffic
*/
export const getTrafficHealth = (item: TrafficItem, direction: Direction): ThresholdStatus => {
  // Get the annotation configuration
  const annotation =
    item.node.type !== NodeType.APP && item.node.healthAnnotation
      ? new RateHealth(item.node.healthAnnotation)
      : undefined;
  // Get the configuration for the node
  const config =
    annotation && annotation.toleranceConfig
      ? annotation.toleranceConfig
      : getRateHealthConfig(item.node.namespace, item.node.name, item.node.type).tolerance;

  // Get tolerances of the configuration for the direction provided
  const tolerances = config.filter(tol => checkExpr(tol.direction, direction));
  // Get the responses like a item with traffic
  const traffic = item.traffic as ProtocolWithTraffic;
  // Aggregate the responses and transform them for calculate the status
  const agg = aggregate(transformEdgeResponses(traffic.responses, traffic.protocol), tolerances, true);
  return calculateStatusGraph(agg, traffic.responses).status;
};
