import { BadgeLocation, LabelPosition, NodeModel, NodeShape, NodeStatus } from '@patternfly/react-topology';
import { PFBadges, PFBadgeType } from 'components/Pf/PfBadges';
import { icons } from 'config';
import {
  BoxByType,
  DecoratedGraphNodeData,
  EdgeLabelMode,
  GraphType,
  NodeType,
  TrafficRate,
  UNKNOWN
} from 'types/Graph';
import { DEGRADED, FAILURE } from 'types/Health';
import Namespace from 'types/Namespace';

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
  dimmed?: boolean;
  highlighted?: boolean;
  hover?: boolean;
  component?: React.ReactNode;
  icon?: React.ReactNode;
  labelIcon?: React.ReactNode;
  labelIconClass?: string;
  labelPosition?: LabelPosition;
  marginX?: number;
  row?: number;
  secondaryLabel?: string;
  selected?: boolean;
  setLocation?: boolean;
  showContextMenu?: boolean;
  showStatusDecorator?: boolean;
  statusDecoratorTooltip?: React.ReactNode;
  x?: number;
  y?: number;
  truncateLength?: number;
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
