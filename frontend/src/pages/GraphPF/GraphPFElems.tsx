import * as React from 'react';
import {
  BadgeLocation,
  Controller,
  Edge,
  EdgeModel,
  EdgeTerminalType,
  GraphElement,
  isEdge,
  isNode,
  LabelPosition,
  Node,
  NodeModel,
  NodeShape,
  NodeStatus,
  TopologyQuadrant
} from '@patternfly/react-topology';
import { PFBadges, PFBadgeType } from 'components/Pf/PfBadges';
import { homeCluster as kialiHomeCluster, icons } from 'config';
import {
  BoxByType,
  CLUSTER_DEFAULT,
  DecoratedGraphEdgeData,
  DecoratedGraphEdgeWrapper,
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
import { Namespace } from 'types/Namespace';
import _ from 'lodash';
import { PFColors } from 'components/Pf/PfColors';
import { getEdgeHealth } from 'types/ErrorRate/GraphEdgeStatus';
import { Span } from 'types/TracingInfo';
import { IconType } from 'config/Icons';
import { NodeDecorator } from './NodeDecorator';
import { LayoutName } from './GraphPF';
import { supportsGroups } from 'utils/GraphUtils';

// Utilities for working with PF Topology
// - most of these add cytoscape-like functions

export type NodeMap = Map<string, NodeModel>;

export type NodeData = DecoratedGraphNodeData & {
  // These are node.data fields that have an impact on the PFT rendering of the node.
  // TODO: Is there an actual type defined for these in PFT?
  attachments?: React.ReactNode; // ie. decorators
  badge?: string;
  badgeBorderColor?: string;
  badgeClassName?: string;
  badgeColor?: string;
  badgeLocation?: BadgeLocation;
  badgeTextColor?: string;
  column?: number;
  component?: React.ReactNode;
  hasSpans?: Span[];
  icon?: React.ReactNode;
  isFind?: boolean;
  isFocus?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isUnhighlighted?: boolean;
  labelIcon?: React.ReactNode;
  labelIconClass?: string;
  labelIconPadding?: number;
  labelPosition?: LabelPosition;
  marginX?: number;
  onHover?: (element: GraphElement, isMouseIn: boolean) => void;
  row?: number;
  secondaryLabel?: string;
  setLocation?: boolean;
  showContextMenu?: boolean;
  showStatusDecorator?: boolean;
  statusDecoratorTooltip?: React.ReactNode;
  truncateLength?: number;
  x?: number;
  y?: number;
};

export type EdgeData = DecoratedGraphEdgeData & {
  endTerminalType: EdgeTerminalType;
  hasSpans?: Span[];
  isFind?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isUnhighlighted?: boolean;
  onHover?: (element: GraphElement, isMouseIn: boolean) => void;
  pathStyle?: React.CSSProperties;
  startTerminalType?: EdgeTerminalType;
  tag?: string;
  tagStatus?: NodeStatus;
};

export type GraphPFSettings = {
  activeNamespaces: Namespace[];
  edgeLabels: EdgeLabelMode[];
  graphType: GraphType;
  showOutOfMesh: boolean;
  showSecurity: boolean;
  showVirtualServices: boolean;
  trafficRates: TrafficRate[];
};

const badgeMap = new Map<string, IconType>()
  .set('CB', icons.istio.circuitBreaker) // bolt
  .set('FI', icons.istio.faultInjection) // ban
  .set('GW', icons.istio.gateway) // globe
  .set('MI', icons.istio.mirroring) // migration
  .set('MS', icons.istio.missingSidecar) // blueprint
  .set('RO', icons.istio.root) // alt-arrow-circle-right
  .set('RR', icons.istio.requestRouting) // code-branch
  .set('RT', icons.istio.requestTimeout) // clock
  .set('TS', icons.istio.trafficShifting) // share-alt
  .set('VS', icons.istio.virtualService) // code-branch
  .set('WE', icons.istio.workloadEntry) // pf-icon-virtual-machine
  .set('WA', icons.istio.waypoint); // pf icon for infrastructure

const EdgeColor = PFColors.Success;
const EdgeColorDead = PFColors.Black500;
const EdgeColorDegraded = PFColors.Warning;
const EdgeColorFailure = PFColors.Danger;
const EdgeColorTCPWithTraffic = PFColors.Blue500;

export const getNodeStatus = (data: NodeData): NodeStatus => {
  if ((data.isBox && data.isBox !== BoxByType.APP) || data.isIdle) {
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

const getDecorator = (element: Node, quadrant: TopologyQuadrant, icon: IconType, tooltip?: string): React.ReactNode => {
  return <NodeDecorator element={element} quadrant={quadrant} icon={icon} tooltip={tooltip} />;
};

export const setNodeAttachments = (node: Node<NodeModel>, settings: GraphPFSettings): void => {
  // PFT provides the ability to add a single Icon (badge) on the label. And so we will use
  // attachments (up to 4) to display what we would have done with label badges in Cytoscape.
  const data = node.getData() as NodeData;
  const attachments = [] as React.ReactNode[];

  if (settings.showOutOfMesh && data.isOutOfMesh) {
    attachments.push(getDecorator(node, TopologyQuadrant.lowerRight, badgeMap.get('MS')!));
  }
  if (data.hasWorkloadEntry) {
    attachments.push(getDecorator(node, TopologyQuadrant.upperRight, badgeMap.get('WE')!));
  }
  if (settings.showVirtualServices) {
    if (data.hasCB) {
      attachments.push(getDecorator(node, TopologyQuadrant.upperLeft, badgeMap.get('CB')!));
    }
    // Because we have limited attachments, just show a single VS attachement and let the
    // Tooltip list the active VS features
    if (data.hasVS) {
      const vsFeatures: string[] = [];
      if (data.hasFaultInjection) {
        vsFeatures.push(badgeMap.get('FI')!.text);
      }
      if (data.hasMirroring) {
        vsFeatures.push(badgeMap.get('MI')!.text);
      }
      if (data.hasRequestRouting) {
        vsFeatures.push(badgeMap.get('RR')!.text);
      }
      if (data.hasRequestTimeout) {
        vsFeatures.push(badgeMap.get('RT')!.text);
      }
      if (data.hasTrafficShifting || data.hasTCPTrafficShifting) {
        vsFeatures.push(badgeMap.get('TS')!.text);
      }
      const tooltip = vsFeatures.length === 0 ? undefined : `${badgeMap.get('VS')!.text}:\n ${vsFeatures.join(' ,')}`;

      attachments.push(getDecorator(node, TopologyQuadrant.lowerLeft, badgeMap.get('VS')!, tooltip));
    }
  }

  if (attachments.length > 0) {
    data.attachments = attachments;
  }
};

export const setNodeLabel = (
  node: NodeModel,
  nodeMap: NodeMap,
  settings: GraphPFSettings,
  layoutName: LayoutName
): void => {
  const data = node.data as NodeData;
  const app = data.app ?? '';
  const cluster = data.cluster;
  const namespace = data.namespace;
  const nodeType = data.nodeType;
  const service = data.service ?? '';
  const version = data.version ?? '';
  const workload = data.workload ?? '';
  const isBox = data.isBox;
  const isBoxed = data.parent;
  let box1Type: string | undefined, box2Type: string | undefined;

  if (isBoxed && supportsGroups(layoutName)) {
    let box1: NodeModel | undefined, box2: NodeModel | undefined;
    box1 = nodeMap.get(data.parent!);
    const box1Data = box1?.data as NodeData;
    box1Type = box1Data.isBox;
    box2 = box1Data.parent ? nodeMap.get(box1Data.parent!) : undefined;
    box2Type = box2 ? (box2.data as NodeData).isBox : undefined;
  }

  const isAppBoxed = box1Type === BoxByType.APP;
  const isNamespaceBoxed = box1Type === BoxByType.NAMESPACE || box2Type === BoxByType.NAMESPACE;
  const isMultiNamespace = settings.activeNamespaces.length > 1;
  const isOutside = data.isOutside;

  // Badges portion of label...

  // PFT provides the ability to add a single Icon (badge) on the label. Given that we can't
  // duplicate what we do with Cytoscape, which is to add multiple badges on the label,
  // we'll reserve the single icon to be used only to identify traffic sources (i.e. roots).
  // Note that a gateway is a special traffic source.
  // Other badges will be added as attachments (decorators) on the node, but that requires
  // the Node, not the NodeModel, and it;s no longer part of the label, so it's not done here.

  if (data.isRoot) {
    if (
      data.isGateway?.ingressInfo?.hostnames?.length !== undefined ||
      data.isGateway?.gatewayAPIInfo?.hostnames?.length !== undefined
    ) {
      data.labelIcon = (
        <span className={`${badgeMap.get('GW')?.className}`} style={{ fontSize: '14px', marginBottom: '1px' }}></span>
      );
    } else {
      data.labelIcon = (
        <span className={`${badgeMap.get('RO')?.className}`} style={{ marginBottom: '1px', marginLeft: '2px' }}></span>
      );
    }
  } else {
    if (data.isGateway?.egressInfo?.hostnames?.length !== undefined) {
      data.labelIcon = <span className={`${badgeMap.get('GW')?.className}`}></span>;
    }
    // A Waypoint should be mutually exclusive with being a traffic source
    if (data.isWaypoint) {
      data.labelIcon = (
        <span className={`${badgeMap.get('WA')?.className}`} style={{ marginBottom: '1px', marginLeft: '2px' }}></span>
      );
    }
  }

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
  const homeCluster = kialiHomeCluster?.name || CLUSTER_DEFAULT;
  if (!!cluster && cluster !== UNKNOWN && cluster !== homeCluster && !isBoxed && isBox !== BoxByType.CLUSTER) {
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
      data.badgeColor = PFColors.BackgroundColor100;
      data.badgeBorderColor = PFColors.Blue300;
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
            if (data.waypoint === 'to' && data.waypointEdge) {
              //labels.push(toFixedByteRate(rate + data.waypointEdge.tcp, includeUnits, '*'));
              labels.push(toFixedByteRate(data.waypointEdge.tcp, includeUnits));
            } //else {
            //labels.push(toFixedByteRate(rate, includeUnits));
            //}
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

  let label = labels.join(' - ');

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
            ? `${icons.istio.circuitBreaker.className} ${label}`
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
  return includeUnits ? `${rate}${units || 'rps'}` : rate;
};

const toFixedErrRate = (num: number): string => {
  num = safeNum(num);
  return `${trimFixed(num.toFixed(num < 1 ? 1 : 0))}%err`;
};

const toFixedByteRate = (num: number, includeUnits: boolean, includeMarker?: string): string => {
  const marker = includeMarker ? includeMarker : '';
  num = safeNum(num);
  if (num < 1024.0) {
    const rate = num < 1.0 ? trimFixed(num.toFixed(2)) : num.toFixed(0);
    return includeUnits ? `${rate}${marker}bps` : `${rate}${marker}`;
  }
  const rate = trimFixed((num / 1024.0).toFixed(2));
  return includeUnits ? `${rate}${marker}kps` : `${rate}${marker}`;
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
    console.info(`Expected number but received string: |${num}|`);
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

const getPathStyleStroke = (data: EdgeData): PFColors => {
  if (!data.hasTraffic) {
    return EdgeColorDead;
  }
  if (data.protocol === 'tcp') {
    return EdgeColorTCPWithTraffic;
  }
  switch (data.healthStatus) {
    case FAILURE.name:
      return EdgeColorFailure;
    case DEGRADED.name:
      return EdgeColorDegraded;
    default:
      return EdgeColor;
  }
};

const getPathStyle = (data: EdgeData): React.CSSProperties => {
  return {
    stroke: getPathStyleStroke(data),
    strokeWidth: 3
  } as React.CSSProperties;
};

export const setEdgeOptions = (edge: EdgeModel, nodeMap: NodeMap, settings: GraphPFSettings): void => {
  const data = edge.data as EdgeData;
  if (data.waypointEdge) {
    data.startTerminalType = data.protocol === Protocol.TCP ? EdgeTerminalType.square : EdgeTerminalType.directional;
  }
  data.endTerminalType = data.protocol === Protocol.TCP ? EdgeTerminalType.square : EdgeTerminalType.directional;
  data.pathStyle = getPathStyle(data);
  data.tag = getEdgeLabel(edge, nodeMap, settings);
  data.tagStatus = getEdgeStatus(data);
};

export const assignEdgeHealth = (
  edges: DecoratedGraphEdgeWrapper[],
  nodeMap: NodeMap,
  settings: GraphPFSettings
): void => {
  edges?.forEach(edge => {
    const edgeData = edge.data as EdgeData;

    if (!edgeData.hasTraffic) {
      return;
    }
    if (edgeData.protocol === 'tcp') {
      return;
    }
    if (edgeData.protocol === 'grpc' && !settings.trafficRates.includes(TrafficRate.GRPC_REQUEST)) {
      return;
    }

    const sourceNodeData = nodeMap.get(edgeData.source!)?.data as NodeData;
    const destNodeData = nodeMap.get(edgeData.target!)?.data as NodeData;
    const statusEdge = getEdgeHealth(edgeData, sourceNodeData, destNodeData);

    switch (statusEdge.status) {
      case FAILURE:
        edgeData.healthStatus = FAILURE.name;
        return;
      case DEGRADED:
        edgeData.healthStatus = DEGRADED.name;
        return;
      default:
        // unset implies healthy or n/a
        return;
    }
  });
};

///// PFT helpers

export const elems = (c: Controller): { edges: Edge[]; nodes: Node[] } => {
  const elems = c.getElements();
  return {
    edges: elems.filter(e => isEdge(e)) as Edge[],
    nodes: elems.filter(e => isNode(e)) as Node[]
  };
};

// TODO: When/if it is fixed this can be replaced with a straight call to node.getAllNodeChildren();
// https://github.com/patternfly/patternfly-react/issues/8350
export const descendents = (node: Node): Node[] => {
  const result: Node[] = [];
  if (!node.isGroup()) {
    return result;
  }

  const children = node.getChildren().filter(e => isNode(e)) as Node[];
  result.push(...children.filter(child => !child.isGroup()));
  children.forEach(child => {
    if (child.isGroup()) {
      result.push(...descendents(child));
    }
  });
  return result;
};

export const ancestors = (node: Node): GraphElement[] => {
  const result: GraphElement[] = [];
  while (node.hasParent()) {
    const parent = node.getParent() as Node;
    result.push(parent);
    node = parent;
  }
  return result;
};

export type SelectOp =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | '!*='
  | '!$='
  | '!^='
  | '*='
  | '$='
  | '^='
  | 'falsy'
  | 'truthy';
export type SelectExp = {
  op?: SelectOp;
  prop: string;
  val?: any;
};
export type SelectAnd = SelectExp[];
export type SelectOr = SelectAnd[];

export const selectOr = (elems: GraphElement[], ors: SelectOr): GraphElement[] => {
  let result = [] as GraphElement[];
  ors.forEach(ands => {
    const andResult = selectAnd(elems, ands);
    result = Array.from(new Set([...result, ...andResult]));
  });
  return result;
};

export const selectAnd = (elems: GraphElement[], ands: SelectAnd): GraphElement[] => {
  let result = elems;
  ands.forEach(exp => (result = select(result, exp)));
  return result;
};

export const select = (elems: GraphElement[], exp: SelectExp): GraphElement[] => {
  return elems.filter(e => {
    const propVal = e.getData()[exp.prop] || '';

    switch (exp.op) {
      case '!=':
        return propVal !== exp.val;
      case '<':
        return propVal < exp.val;
      case '>':
        return propVal > exp.val;
      case '>=':
        return propVal >= exp.val;
      case '<=':
        return propVal <= exp.val;
      case '!*=':
        return !(propVal as string).includes(exp.val as string);
      case '!$=':
        return !(propVal as string).endsWith(exp.val as string);
      case '!^=':
        return !(propVal as string).startsWith(exp.val as string);
      case '*=':
        return (propVal as string).includes(exp.val as string);
      case '$=':
        return (propVal as string).endsWith(exp.val as string);
      case '^=':
        return (propVal as string).startsWith(exp.val as string);
      case 'falsy':
        return !propVal;
      case 'truthy':
        return !!propVal;
      default:
        return propVal === exp.val;
    }
  });
};

export const edgesIn = (nodes: Node[], sourceNodes?: Node[]): Edge[] => {
  const result = [] as Edge[];
  nodes.forEach(n =>
    result.push(...n.getTargetEdges().filter(e => !sourceNodes || sourceNodes.includes(e.getSource())))
  );
  return result;
};

export const edgesOut = (nodes: Node[], destNodes?: Node[]): Edge[] => {
  const result = [] as Edge[];
  nodes.forEach(n => result.push(...n.getSourceEdges().filter(e => !destNodes || destNodes.includes(e.getTarget()))));
  return result;
};

export const edgesInOut = (nodes: Node[]): Edge[] => {
  const result = edgesIn(nodes);
  result.push(...edgesOut(nodes));
  return Array.from(new Set(result));
};

export const nodesIn = (nodes: Node[]): Node[] => {
  const result = [] as Node[];
  edgesIn(nodes).forEach(e => result.push(e.getSource()));
  return Array.from(new Set(result));
};

export const nodesOut = (nodes: Node[]): Node[] => {
  const result = [] as Node[];
  edgesOut(nodes).forEach(e => result.push(e.getTarget()));
  return Array.from(new Set(result));
};

export const predecessors = (node: Node, processed: GraphElement[]): GraphElement[] => {
  let result = [] as GraphElement[];
  const targetEdges = node.getTargetEdges();
  const sourceNodes = targetEdges.map(e => e.getSource());
  result = result.concat(targetEdges, sourceNodes);

  sourceNodes.forEach(n => {
    if (processed.indexOf(n) === -1) {
      // Processed nodes is used to avoid infinite loops
      processed = processed.concat(n);
      result = result.concat(predecessors(n, processed));
    }
  });

  return result;
};

export const successors = (node: Node, processed: GraphElement[]): GraphElement[] => {
  let result = [] as GraphElement[];
  const sourceEdges = node.getSourceEdges();
  const targetNodes = sourceEdges.map(e => e.getTarget());
  result = result.concat(sourceEdges, targetNodes);
  targetNodes.forEach(n => {
    if (processed.indexOf(n) === -1) {
      // Processed nodes is used to avoid infinite loops
      processed = processed.concat(n);
      result = result.concat(successors(n, processed));
    }
  });
  return result;
};

export const leafNodes = (nodes: Node[]): Node[] => {
  return nodes.filter(n => n.getSourceEdges().length === 0);
};
