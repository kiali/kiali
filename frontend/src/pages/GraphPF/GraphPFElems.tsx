import {
  BadgeLocation,
  EdgeModel,
  EdgeTerminalType,
  LabelPosition,
  NodeModel,
  NodeShape,
  NodeStatus
} from '@patternfly/react-topology';
import { PFBadges, PFBadgeType } from 'components/Pf/PfBadges';
import { icons } from 'config';
import {
  BoxByType,
  DecoratedGraphEdgeData,
  DecoratedGraphNodeData,
  EdgeLabelMode,
  GraphType,
  NodeType,
  numLabels,
  Protocol,
  TrafficRate,
  UNKNOWN
} from 'types/Graph';
import { DEGRADED, FAILURE } from 'types/Health';
import Namespace from 'types/Namespace';
import _ from 'lodash';
import { PFColors } from 'components/Pf/PfColors';

// Utilities for working with PF Topology
// - most of these add cytoscape-like functions

export type NodeMap = Map<string, NodeModel>;

export type NodeData = DecoratedGraphNodeData & {
  // These are node.data fields that have an impact on the PFT rendering of the node.
  // TODO: Is there an actual type defined for these in PFT?
  badge?: string;
  badgeBorderColor?: string;
  badgeClassName?: string;
  badgeColor?: string;
  badgeLocation?: BadgeLocation;
  badgeTextColor?: string;
  column?: number;
  component?: React.ReactNode;
  icon?: React.ReactNode;
  isDimmed?: boolean;
  isHidden?: boolean;
  isHighlighted?: boolean;
  isHovered?: boolean;
  isSelected?: boolean;
  labelIcon?: React.ReactNode;
  labelIconClass?: string;
  labelPosition?: LabelPosition;
  marginX?: number;
  row?: number;
  secondaryLabel?: string;
  setLocation?: boolean;
  showContextMenu?: boolean;
  showStatusDecorator?: boolean;
  statusDecoratorTooltip?: React.ReactNode;
  x?: number;
  y?: number;
  truncateLength?: number;
};

export type EdgeData = DecoratedGraphEdgeData & {
  endTerminalType: EdgeTerminalType;
  isSelected?: boolean;
  pathStyle?: React.CSSProperties;
  tag?: string;
  tagStatus?: NodeStatus;
};

export type GraphPFSettings = {
  activeNamespaces: Namespace[];
  edgeLabels: EdgeLabelMode[];
  graphType: GraphType;
  homeCluster: string;
  showMissingSidecars: boolean;
  showSecurity: boolean;
  showVirtualServices: boolean;
  trafficRates: TrafficRate[];
};

const badgeMap = new Map<string, string>()
  .set('CB', icons.istio.circuitBreaker.className) // bolt
  .set('FI', icons.istio.faultInjection.className) // ban
  .set('GW', icons.istio.gateway.className) // globe
  .set('MI', icons.istio.mirroring.className) // migration
  .set('MS', icons.istio.missingSidecar.className) // blueprint
  .set('RO', icons.istio.root.className) // alt-arrow-circle-right
  .set('VS', icons.istio.virtualService.className) // code-branch
  .set('RR', icons.istio.requestRouting.className) // code-branch
  .set('RT', icons.istio.requestTimeout.className) // clock
  .set('TS', icons.istio.trafficShifting.className) // share-alt
  .set('WE', icons.istio.workloadEntry.className); // pf-icon-virtual-machine

const EdgeColor = PFColors.Success;
const EdgeColorDead = PFColors.Black500;
const EdgeColorDegraded = PFColors.Warning;
const EdgeColorFailure = PFColors.Danger;
const EdgeColorTCPWithTraffic = PFColors.Blue600;

export const getNodeStatus = (data: NodeData): NodeStatus => {
  if (data.isBox || data.isIdle) {
    return NodeStatus.default;
  }

  switch (data.healthStatus) {
    case DEGRADED.name:
      return NodeStatus.warning;
    case FAILURE.name:
      return NodeStatus.danger;
    default:
      return NodeStatus.success;
  }
};

export const getNodeShape = (data: NodeData): NodeShape => {
  switch (data.nodeType) {
    case NodeType.AGGREGATE:
      return NodeShape.hexagon;
    case NodeType.APP:
      return NodeShape.rect;
    case NodeType.SERVICE:
      return data.isServiceEntry ? NodeShape.trapezoid : NodeShape.rhombus;
    case NodeType.WORKLOAD:
      return NodeShape.circle;
    default:
      return NodeShape.ellipse;
  }
};

export const setNodeLabel = (node: NodeModel, nodeMap: NodeMap, settings: GraphPFSettings): void => {
  const data = node.data as NodeData;
  const app = data.app || '';
  const cluster = data.cluster;
  const namespace = data.namespace;
  const nodeType = data.nodeType;
  const service = data.service || '';
  const version = data.version || '';
  const workload = data.workload || '';
  const isBox = data.isBox;
  const isBoxed = data.parent;
  let box1Type, box2Type: string | undefined;
  if (isBoxed) {
    let box1, box2: NodeModel | undefined;
    box1 = nodeMap.get(data.parent!);
    const box1Data = box1.data as NodeData;
    box1Type = box1Data.isBox;
    box2 = box1Data.parent ? nodeMap.get(box1Data.parent!) : undefined;
    box2Type = box2 ? (box2.data as NodeData).isBox : undefined;
  }
  const isAppBoxed = box1Type === BoxByType.APP;
  const isNamespaceBoxed = box1Type === BoxByType.NAMESPACE || box2Type === BoxByType.NAMESPACE;
  const isMultiNamespace = settings.activeNamespaces.length > 1;
  const isOutside = data.isOutside;

  // Badges portion of label...

  let badges = [] as string[];
  if (settings.showMissingSidecars && data.hasMissingSC) {
    badges.push(badgeMap.get('MS')!);
  }
  if (settings.showVirtualServices) {
    if (data.hasCB) {
      badges.push(badgeMap.get('CB')!);
    }
    // If there's an additional traffic scenario present then it's assumed
    // that there is a VS present so the VS badge is omitted.
    if (data.hasVS) {
      const hasKialiScenario =
        data.hasFaultInjection ||
        data.hasMirroring ||
        data.hasRequestRouting ||
        data.hasRequestTimeout ||
        data.hasTCPTrafficShifting ||
        data.hasTrafficShifting;
      if (!hasKialiScenario) {
        badges.push(badgeMap.get('VS')!);
      } else {
        if (data.hasFaultInjection) {
          badges.push(badgeMap.get('FI')!);
        }
        if (data.hasMirroring) {
          badges.push(badgeMap.get('MI')!);
        }
        if (data.hasTrafficShifting || data.hasTCPTrafficShifting) {
          badges.push(badgeMap.get('TS')!);
        }
        if (data.hasRequestTimeout) {
          badges.push(badgeMap.get('RT')!);
        }
        if (data.hasRequestRouting) {
          badges.push(badgeMap.get('RR')!);
        }
      }
    }

    if (data.hasWorkloadEntry) {
      badges.push(badgeMap.get('WE')!);
    }
    if (data.isRoot) {
      if (
        data.isGateway?.ingressInfo?.hostnames?.length !== undefined ||
        data.isGateway?.gatewayAPIInfo?.hostnames?.length !== undefined
      ) {
        badges.push(badgeMap.get('GW')!);
      }
      badges.push(badgeMap.get('RO')!);
    } else {
      if (data.isGateway?.egressInfo?.hostnames?.length !== undefined) {
        badges.push(badgeMap.get('GW')!);
      }
    }
  }
  // TODO: PFT can only handle one badge/icon at the moment, need an RFE
  if (badges.length > 0) {
    data.labelIcon = <span className={`${badges[0]}`}></span>;
  }
  data.component = <span className={`${badges[0]}`}></span>;

  // Content portion of label (i.e. the text)...
  const content: string[] = [];

  // append namespace if necessary
  if (
    (isMultiNamespace || isOutside) &&
    !!namespace &&
    namespace !== UNKNOWN &&
    !isAppBoxed &&
    !isNamespaceBoxed &&
    isBox !== BoxByType.NAMESPACE
  ) {
    content.push(`(${namespace})`);
  }

  // append cluster if necessary
  if (!!cluster && cluster !== UNKNOWN && cluster !== settings.homeCluster && !isBoxed && isBox !== BoxByType.CLUSTER) {
    content.push(`(${cluster})`);
  }

  switch (nodeType) {
    case NodeType.AGGREGATE:
      content.unshift(data.aggregateValue!);
      break;
    case NodeType.APP:
      if (isAppBoxed) {
        if (settings.graphType === GraphType.APP) {
          content.unshift(app);
        } else if (version && version !== UNKNOWN) {
          content.unshift(version);
        } else {
          content.unshift(workload ? workload : app);
        }
      } else {
        if (settings.graphType === GraphType.APP || version === UNKNOWN) {
          content.unshift(app);
        } else {
          content.unshift(version);
          content.unshift(app);
        }
      }
      break;
    case NodeType.BOX:
      switch (isBox) {
        case BoxByType.APP:
          content.unshift(app);
          break;
        case BoxByType.CLUSTER:
          content.unshift(data.cluster);
          break;
        case BoxByType.NAMESPACE:
          content.unshift(data.namespace);
          break;
      }
      break;
    case NodeType.SERVICE:
      content.unshift(service);
      break;
    case NodeType.UNKNOWN:
      content.unshift(UNKNOWN);
      break;
    case NodeType.WORKLOAD:
      content.unshift(workload);
      break;
    default:
      content.unshift('error');
  }

  // The final label...

  if (isBox) {
    let pfBadge: PFBadgeType | undefined;
    switch (isBox) {
      case BoxByType.APP:
        pfBadge = PFBadges.App;
        break;
      case BoxByType.CLUSTER:
        pfBadge = PFBadges.Cluster;
        break;
      case BoxByType.NAMESPACE:
        pfBadge = PFBadges.Namespace;
        break;
      default:
        console.warn(`GraphSyles: Unexpected box [${isBox}] `);
    }

    if (pfBadge) {
      data.badge = pfBadge.badge;
    }
    node.label = content.shift();
    if (content.length > 0) {
      data.secondaryLabel = content.join(':');
    }
    return;
  }

  node.label = content.shift();
  if (content.length > 0) {
    data.secondaryLabel = content.join(':');
  }

  return;
};

const getEdgeLabel = (edge: EdgeModel, nodeMap: NodeMap, settings: GraphPFSettings): string => {
  const data = edge.data as EdgeData;
  const edgeLabels = settings.edgeLabels;
  const isVerbose = data.isSelected;
  const includeUnits = isVerbose || numLabels(edgeLabels) > 1;
  let labels = [] as string[];

  if (edgeLabels.includes(EdgeLabelMode.TRAFFIC_RATE)) {
    let rate = 0;
    let pErr = 0;
    if (data.http > 0) {
      rate = data.http;
      pErr = data.httpPercentErr > 0 ? data.httpPercentErr : 0;
    } else if (data.grpc > 0) {
      rate = data.grpc;
      pErr = data.grpcPercentErr > 0 ? data.grpcPercentErr : 0;
    } else if (data.tcp > 0) {
      rate = data.tcp;
    }

    if (rate > 0) {
      if (pErr > 0) {
        labels.push(`${toFixedRequestRate(rate, includeUnits)}\n${toFixedErrRate(pErr)}`);
      } else {
        switch (data.protocol) {
          case Protocol.GRPC:
            if (settings.trafficRates.includes(TrafficRate.GRPC_REQUEST)) {
              labels.push(toFixedRequestRate(rate, includeUnits));
            } else {
              labels.push(toFixedRequestRate(rate, includeUnits, 'mps'));
            }
            break;
          case Protocol.TCP:
            labels.push(toFixedByteRate(rate, includeUnits));
            break;
          default:
            labels.push(toFixedRequestRate(rate, includeUnits));
            break;
        }
      }
    }
  }

  if (edgeLabels.includes(EdgeLabelMode.RESPONSE_TIME_GROUP)) {
    let responseTime = data.responseTime;

    if (responseTime > 0) {
      labels.push(toFixedDuration(responseTime));
    }
  }

  if (edgeLabels.includes(EdgeLabelMode.THROUGHPUT_GROUP)) {
    let rate = data.throughput;

    if (rate > 0) {
      labels.push(toFixedByteRate(rate, includeUnits));
    }
  }

  if (edgeLabels.includes(EdgeLabelMode.TRAFFIC_DISTRIBUTION)) {
    let pReq;
    if (data.httpPercentReq > 0) {
      pReq = data.httpPercentReq;
    } else if (data.grpcPercentReq > 0) {
      pReq = data.grpcPercentReq;
    }
    if (pReq > 0 && pReq < 100) {
      labels.push(toFixedPercent(pReq));
    }
  }

  let label = labels.join('\n');

  if (isVerbose) {
    const protocol = data.protocol;
    label = protocol ? `${protocol}\n${label}` : label;
  }

  const mtlsPercentage = data.isMTLS;
  let lockIcon = false;
  if (settings.showSecurity && data.hasTraffic) {
    if (mtlsPercentage && mtlsPercentage > 0) {
      lockIcon = true;
      label = `${icons.istio.mtls.ascii}\n${label}`;
    }
  }

  if (data.hasTraffic && data.responses) {
    if (nodeMap.get(edge.target!)?.data?.hasCB) {
      const responses = data.responses;
      for (let code of _.keys(responses)) {
        // TODO: Not 100% sure we want "UH" code here ("no healthy upstream hosts") but based on timing I have
        // seen this code returned and not "UO". "UO" is returned only when the circuit breaker is caught open.
        // But if open CB is responsible for removing possible destinations the "UH" code seems preferred.
        if (responses[code]['UO'] || responses[code]['UH']) {
          label = lockIcon
            ? `$icons.istio.circuitBreaker.className} ${label}`
            : `${icons.istio.circuitBreaker.className}\n${label}`;
          break;
        }
      }
    }
  }

  return label;
};

const trimFixed = (fixed: string): string => {
  if (!fixed.includes('.')) {
    return fixed;
  }
  while (fixed.endsWith('0')) {
    fixed = fixed.slice(0, -1);
  }
  return fixed.endsWith('.') ? (fixed = fixed.slice(0, -1)) : fixed;
};

const toFixedRequestRate = (num: number, includeUnits: boolean, units?: string): string => {
  num = safeNum(num);
  const rate = trimFixed(num.toFixed(2));
  return includeUnits ? `${rate} ${units || 'rps'}` : rate;
};

const toFixedErrRate = (num: number): string => {
  num = safeNum(num);
  return `${trimFixed(num.toFixed(num < 1 ? 1 : 0))}% err`;
};

const toFixedByteRate = (num: number, includeUnits: boolean): string => {
  num = safeNum(num);
  if (num < 1024.0) {
    const rate = num < 1.0 ? trimFixed(num.toFixed(2)) : num.toFixed(0);
    return includeUnits ? `${rate} bps` : rate;
  }
  const rate = trimFixed((num / 1024.0).toFixed(2));
  return includeUnits ? `${rate} kps` : rate;
};

const toFixedPercent = (num: number): string => {
  num = safeNum(num);
  return `${trimFixed(num.toFixed(1))}%`;
};

const toFixedDuration = (num: number): string => {
  num = safeNum(num);
  if (num < 1000) {
    return `${num.toFixed(0)}ms`;
  }
  return `${trimFixed((num / 1000.0).toFixed(2))}s`;
};

// This is due to us never having figured out why a tiny fraction of what-we-expect-to-be-numbers
// are in fact strings.  We don't know if our conversion in GraphData.ts has a flaw, or whether
// something else happens post-conversion.
const safeNum = (num: any): number => {
  if (Number.isFinite(num)) {
    return num;
  }
  if (typeof num === 'string' || num instanceof String) {
    console.log(`Expected number but received string: |${num}|`);
  }
  // this will return NaN if the string is 'NaN' or any other non-number
  return Number(num);
};

const getEdgeStatus = (data: EdgeData): NodeStatus => {
  if (!data.hasTraffic) {
    return NodeStatus.default;
  }
  if (data.protocol === 'tcp') {
    return NodeStatus.info;
  }

  switch (data.healthStatus) {
    case FAILURE.name:
      return NodeStatus.danger;
    case DEGRADED.name:
      return NodeStatus.warning;
    default:
      return NodeStatus.success;
  }
};

const getPathStyle = (data: EdgeData): React.CSSProperties => {
  if (!data.hasTraffic) {
    return { stroke: EdgeColorDead };
  }
  if (data.protocol === 'tcp') {
    return { stroke: EdgeColorTCPWithTraffic };
  }

  switch (data.healthStatus) {
    case FAILURE.name:
      return { stroke: EdgeColorFailure };
    case DEGRADED.name:
      return { stroke: EdgeColorDegraded };
    default:
      return { stroke: EdgeColor };
  }
};

export const setEdgeOptions = (edge: EdgeModel, nodeMap: NodeMap, settings: GraphPFSettings): void => {
  const data = edge.data as EdgeData;

  data.endTerminalType = data.protocol === Protocol.TCP ? EdgeTerminalType.cross : EdgeTerminalType.directional;
  data.tag = getEdgeLabel(edge, nodeMap, settings);
  data.tagStatus = getEdgeStatus(data);
  data.pathStyle = getPathStyle(data);
};
