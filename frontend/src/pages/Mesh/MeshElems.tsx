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
  NodeStatus
} from '@patternfly/react-topology';
import { PFBadges, PFBadgeType } from 'components/Pf/PfBadges';
import { DEGRADED, FAILURE } from 'types/Health';
import { PFColors } from 'components/Pf/PfColors';
import { Span } from 'types/TracingInfo';
import { DecoratedMeshEdgeData, DecoratedMeshEdgeWrapper, DecoratedMeshNodeData, MeshInfraType } from 'types/Mesh';
import { BoxByType } from 'types/Graph';

// Utilities for working with PF Topology
// - most of these add cytoscape-like functions

export type NodeMap = Map<string, NodeModel>;

export type NodeData = DecoratedMeshNodeData & {
  // These are node.data fields that have an impact on the PFT rendering of the node.
  // TODO: Is there an actual type defined for these in PFT?
  attachments?: React.ReactNode; // ie. decorators
  badge?: string;
  badgeBorderColor?: string;
  badgeClassName?: string;
  badgeColor?: string;
  badgeLocation?: BadgeLocation;
  badgeTextColor?: string;
  collapsible?: boolean; // for groups
  column?: number;
  component?: React.ReactNode;
  icon?: React.ReactNode;
  isCollapsed?: boolean; // for groups
  isFind?: boolean;
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
  x?: number;
  y?: number;
  truncateLength?: number;
};

export type EdgeData = DecoratedMeshEdgeData & {
  endTerminalType: EdgeTerminalType;
  hasSpans?: Span[];
  isFind?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isUnhighlighted?: boolean;
  onHover?: (element: GraphElement, isMouseIn: boolean) => void;
  pathStyle?: React.CSSProperties;
  tag?: string;
  tagStatus?: NodeStatus;
};

const EdgeColor = PFColors.Success;
const EdgeColorDegraded = PFColors.Warning;
const EdgeColorFailure = PFColors.Danger;

export const getNodeStatus = (data: NodeData): NodeStatus => {
  if (data.isBox && data.isBox) {
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
    default:
      return NodeShape.circle;
  }
};

export const setNodeAttachments = (_node: Node<NodeModel>): void => {
  return;
};

export const setNodeLabel = (node: NodeModel, _nodeMap: NodeMap): void => {
  const data = node.data as NodeData;
  const infraName = data.infraName;
  const infraType = data.infraType;
  const isBox = data.isBox;

  // Badges portion of label... TODO or not needed?

  // Content portion of label (i.e. the text)...
  const content: string[] = [];

  // append name
  if (!isBox) {
    content.push(infraName);
  }

  // set PfBadge
  let pfBadge: PFBadgeType | undefined;
  if (isBox) {
    switch (isBox) {
      case BoxByType.CLUSTER:
        content.push(data.cluster);
        pfBadge = PFBadges.Cluster;
        break;
      case BoxByType.NAMESPACE:
      case BoxByType.OTHER:
        content.push(data.namespace);
        pfBadge = PFBadges.Namespace;
        break;
      default:
        console.warn(`MeshElems: Unexpected box [${isBox}] `);
    }
  } else {
    switch (infraType) {
      case MeshInfraType.CLUSTER:
        pfBadge = PFBadges.Cluster;
        break;
      case MeshInfraType.ISTIOD:
        pfBadge = PFBadges.Istio;
        break;
      case MeshInfraType.KIALI:
        pfBadge = PFBadges.Kiali;
        break;
      case MeshInfraType.METRIC_STORE:
        pfBadge = PFBadges.MetricStore;
        break;
      case MeshInfraType.NAMESPACE:
        pfBadge = PFBadges.Namespace;
        break;
      case MeshInfraType.TRACE_STORE:
        pfBadge = PFBadges.TraceStore;
        break;
      default:
        console.warn(`MeshElems: Unexpected infraType [${infraType}] `);
    }
  }
  if (pfBadge) {
    data.badge = pfBadge.badge;
  }
  node.label = content.shift();
  if (content.length > 0) {
    data.secondaryLabel = content.join(':');
  }
  return;
};

const getEdgeLabel = (_edge: EdgeModel, _nodeMap: NodeMap): string => {
  //const data = edge.data as EdgeData;

  // Currently no edge labels

  return '';
};

const getEdgeStatus = (data: EdgeData): NodeStatus => {
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

export const setEdgeOptions = (edge: EdgeModel, nodeMap: NodeMap): void => {
  const data = edge.data as EdgeData;

  data.endTerminalType = EdgeTerminalType.directional;
  data.pathStyle = getPathStyle(data);
  data.tag = getEdgeLabel(edge, nodeMap);
  data.tagStatus = getEdgeStatus(data);
};

export const assignEdgeHealth = (_edges: DecoratedMeshEdgeWrapper[], _nodeMap: NodeMap) => {
  // unset implies healthy or n/a
  return;
};

///// PFT helpers

export const elems = (c: Controller): { nodes: Node[]; edges: Edge[] } => {
  const elems = c.getElements();
  return {
    nodes: elems.filter(e => isNode(e)) as Node[],
    edges: elems.filter(e => isEdge(e)) as Edge[]
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
  prop: string;
  val?: any;
  op?: SelectOp;
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

export const predecessors = (node: Node): GraphElement[] => {
  let result = [] as GraphElement[];
  const targetEdges = node.getTargetEdges();
  const sourceNodes = targetEdges.map(e => e.getSource());
  result = result.concat(targetEdges, sourceNodes);
  sourceNodes.forEach(n => (result = result.concat(predecessors(n))));
  return result;
};

export const successors = (node: Node): GraphElement[] => {
  let result = [] as GraphElement[];
  const sourceEdges = node.getSourceEdges();
  const targetNodes = sourceEdges.map(e => e.getTarget());
  result = result.concat(sourceEdges, targetNodes);
  targetNodes.forEach(n => (result = result.concat(successors(n))));
  return result;
};

export const leafNodes = (nodes: Node[]): Node[] => {
  return nodes.filter(n => n.getSourceEdges().length === 0);
};
