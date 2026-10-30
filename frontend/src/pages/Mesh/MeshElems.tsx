import type { CSSProperties, ReactNode } from 'react';
import { EdgeTerminalType, NodeShape, NodeStatus } from '@patternfly/react-topology';
import type {
  BadgeLocation,
  EdgeModel,
  GraphElement,
  LabelPosition,
  Node,
  NodeModel
} from '@patternfly/react-topology';
import { PFBadges } from 'components/Pf/PfBadges';
import type { PFBadgeType } from 'components/Pf/PfBadges';
import { DEGRADED, FAILURE } from 'types/Health';
import { MeshInfraType } from 'types/Mesh';
import type { DecoratedMeshEdgeData, DecoratedMeshEdgeWrapper, DecoratedMeshNodeData } from 'types/Mesh';
import { BoxByType } from 'types/Graph';
import type { Namespace } from 'types/Namespace';
import type { NamespaceInfo } from 'types/NamespaceInfo';
import type { WaypointTrafficSplit } from 'types/WaypointTraffic';
import { findGatewayWaypointSplit, withWaypointCanarySecondaryLabel } from 'utils/WaypointTrafficUtils';

// Utilities for working with PF Topology

export type NodeMap = Map<string, NodeModel>;

export type NodeData = DecoratedMeshNodeData & {
  // These are node.data fields that have an impact on the PFT rendering of the node.
  // TODO: Is there an actual type defined for these in PFT?
  attachments?: ReactNode; // ie. decorators
  badge?: string;
  badgeBorderColor?: string;
  badgeClassName?: string;
  badgeColor?: string;
  badgeLocation?: BadgeLocation;
  badgeTextColor?: string;
  collapsible?: boolean; // for groups
  column?: number;
  component?: ReactNode;
  hideContextMenuKebab?: boolean;
  isCollapsed?: boolean; // for groups
  isFind?: boolean;
  isFocus?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isUnhighlighted?: boolean;
  labelIcon?: ReactNode;
  labelIconClass?: string;
  labelIconPadding?: number;
  labelPosition?: LabelPosition;
  onCollapseChange?: (group: Node, collapsed: boolean) => void;
  onHover?: (element: GraphElement, isMouseIn: boolean) => void;
  secondaryLabel?: string;
  setLocation?: boolean;
  showContextMenu?: boolean;
  showStatusDecorator?: boolean;
  statusDecoratorTooltip?: ReactNode;
  truncateLength?: number;
  x?: number;
  y?: number;
};

export type EdgeData = DecoratedMeshEdgeData & {
  endTerminalStatus: NodeStatus;
  endTerminalType: EdgeTerminalType;
  isFind?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isUnhighlighted?: boolean;
  onHover?: (element: GraphElement, isMouseIn: boolean) => void;
  pathStyle?: CSSProperties;
  tag?: string;
  tagStatus?: NodeStatus;
};

export const getNodeStatus = (data: NodeData): NodeStatus => {
  if (data.isBox) {
    return NodeStatus.default;
  }

  switch (data.healthStatus) {
    case DEGRADED.id:
      return NodeStatus.warning;
    case FAILURE.id:
      return NodeStatus.danger;
    default:
      return NodeStatus.success;
  }
};

export const getNodeShape = (data: NodeData): NodeShape => {
  switch (data.infraType) {
    case MeshInfraType.DATAPLANE:
      return NodeShape.rect;
    case MeshInfraType.GATEWAY:
    case MeshInfraType.WAYPOINT:
      return NodeShape.rhombus;
    default:
      return NodeShape.hexagon;
  }
};

export const setNodeAttachments = (_node: Node<NodeModel>): void => {
  return;
};

export const setNodeLabel = (node: NodeModel, _nodeMap: NodeMap, namespaces?: Namespace[]): void => {
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
      case MeshInfraType.GATEWAY:
        pfBadge = PFBadges.Gateway;
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
      case MeshInfraType.PERSES:
        pfBadge = PFBadges.Perses;
        break;
      case MeshInfraType.TRACE_STORE:
        pfBadge = PFBadges.TraceStore;
        break;
      case MeshInfraType.WAYPOINT:
        pfBadge = PFBadges.Waypoint;
        break;
      case MeshInfraType.ZTUNNEL:
        pfBadge = PFBadges.ZTUNNEL;
        break;
      default:
        console.warn(`MeshElems: Unexpected infraType [${infraType}] `);
    }
  }
  if (pfBadge) {
    data.badge = pfBadge.badge;

    // Different badge styles for groups and node labels
    if (node.type === 'group') {
      data.badgeColor = 'var(--pf-topology__group__label__node__label__background--Fill)';
      data.badgeBorderColor = 'var(--pf-topology__group__label__text--Fill)';
      data.badgeTextColor = 'var(--pf-topology__group__label__text--Fill)';
    } else {
      data.badgeColor = 'var(--pf-topology__node__label__background--Fill)';
      data.badgeBorderColor = 'var(--pf-topology__node__label__text--Fill)';
      data.badgeTextColor = 'var(--pf-topology__node__label__text--Fill)';
    }
  }

  node.label = content.shift();
  // Always reset secondaryLabel; leftover text piles up when setNodeLabel re-runs.
  data.secondaryLabel = content.length > 0 ? content.join(':') : undefined;

  if (infraType === MeshInfraType.WAYPOINT && !isBox) {
    const split =
      (data.infraData?.WaypointTrafficSplit as WaypointTrafficSplit | undefined) ??
      findGatewayWaypointSplit(namespaces ?? [], infraName, data.namespace, data.cluster);
    data.secondaryLabel = withWaypointCanarySecondaryLabel({
      includeWeight: false,
      secondaryLabel: data.secondaryLabel,
      split,
      workload: infraName,
      workloadNamespace: data.namespace
    });
  }

  data.hideContextMenuKebab = true;

  return;
};

const getEdgeLabel = (_edge: EdgeModel, _nodeMap: NodeMap): string => {
  //const data = edge.data as EdgeData;

  // Currently no edge labels

  return '';
};

const getEdgeStatus = (data: EdgeData): NodeStatus => {
  switch (data.healthStatus) {
    case FAILURE.id:
      return NodeStatus.danger;
    case DEGRADED.id:
      return NodeStatus.warning;
    default:
      return NodeStatus.default;
  }
};

const getPathStyle = (data: EdgeData): CSSProperties => {
  switch (data.healthStatus) {
    case FAILURE.id:
    case DEGRADED.id:
      return {
        strokeWidth: 6,
        strokeDasharray: '10 10'
      } as CSSProperties;
    default:
      return {
        strokeWidth: 3
      } as CSSProperties;
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
