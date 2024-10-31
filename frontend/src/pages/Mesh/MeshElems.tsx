import * as React from 'react';
import {
  BadgeLocation,
  EdgeModel,
  EdgeTerminalType,
  GraphElement,
  LabelPosition,
  Node,
  NodeModel,
  NodeShape,
  NodeStatus
} from '@patternfly/react-topology';
import { PFBadges, PFBadgeType } from 'components/Pf/PfBadges';
import { DEGRADED, FAILURE } from 'types/Health';
import { DecoratedMeshEdgeData, DecoratedMeshEdgeWrapper, DecoratedMeshNodeData, MeshInfraType } from 'types/Mesh';
import { BoxByType } from 'types/Graph';
import { NamespaceInfo } from 'types/NamespaceInfo';
import { PFColors } from 'components/Pf/PfColors';

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
  isCollapsed?: boolean; // for groups
  labelIcon?: React.ReactNode;
  labelIconClass?: string;
  labelIconPadding?: number;
  labelPosition?: LabelPosition;
  onCollapseChange?: (group: Node, collapsed: boolean) => void;
  secondaryLabel?: string;
  setLocation?: boolean;
  showContextMenu?: boolean;
  showStatusDecorator?: boolean;
  statusDecoratorTooltip?: React.ReactNode;
  truncateLength?: number;
  x?: number;
  y?: number;
  // These are additions we've made for our own styling
  // eslint-disable-next-line @typescript-eslint/member-ordering
  isFind?: boolean;
  isFocus?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isUnhighlighted?: boolean;
  onHover?: (element: GraphElement, isMouseIn: boolean) => void;
};

export type EdgeData = DecoratedMeshEdgeData & {
  endTerminalStatus: NodeStatus;
  endTerminalType: EdgeTerminalType;
  isFind?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isUnhighlighted?: boolean;
  onHover?: (element: GraphElement, isMouseIn: boolean) => void;
  pathStyle?: React.CSSProperties;
  tag?: string;
  tagStatus?: NodeStatus;
};

export const getNodeStatus = (data: NodeData): NodeStatus => {
  if (data.isBox) {
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
  switch (data.infraType) {
    case MeshInfraType.DATAPLANE:
      return NodeShape.rect;
    default:
      return NodeShape.hexagon;
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
  content.push(infraName);

  // set PfBadge
  let pfBadge: PFBadgeType | undefined;
  if (isBox) {
    switch (isBox) {
      case BoxByType.CLUSTER:
        if (!data.isExternal) {
          pfBadge = PFBadges.Cluster;
        }
        break;
      case BoxByType.NAMESPACE:
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
      case MeshInfraType.DATAPLANE:
        pfBadge = PFBadges.DataPlane;
        content.push(`${(data.infraData as NamespaceInfo[]).length} Namespaces`);
        break;
      case MeshInfraType.GRAFANA:
        pfBadge = PFBadges.Grafana;
        break;
      case MeshInfraType.ISTIOD:
        pfBadge = PFBadges.Istio;
        if (data.infraData?.tag) {
          content.push(`Tag: ${data.infraData.tag.name}`);
        }
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
    data.badgeColor = PFColors.BackgroundColor100;
    data.badgeBorderColor = PFColors.Blue300;
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
      return NodeStatus.default;
  }
};

const getPathStyle = (data: EdgeData): React.CSSProperties => {
  switch (data.healthStatus) {
    case FAILURE.name:
    case DEGRADED.name:
      return {
        strokeWidth: 6,
        strokeDasharray: '10 10'
      } as React.CSSProperties;
    default:
      return {
        strokeWidth: 3
      } as React.CSSProperties;
  }
};

export const setEdgeOptions = (edge: EdgeModel, nodeMap: NodeMap): void => {
  const data = edge.data as EdgeData;
  const status = getEdgeStatus(data);

  data.endTerminalStatus = status;
  data.endTerminalType = EdgeTerminalType.none;
  data.pathStyle = getPathStyle(data);
  data.tag = getEdgeLabel(edge, nodeMap);
  data.tagStatus = status;
};

export const assignEdgeHealth = (_edges: DecoratedMeshEdgeWrapper[], _nodeMap: NodeMap): void => {
  // unset implies healthy or n/a
  return;
};
