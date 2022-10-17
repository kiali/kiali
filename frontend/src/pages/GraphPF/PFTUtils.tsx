// Utilities for working with PF Topology
// - most of these add cytoscape-like functions

import { NodeModel, NodeShape } from '@patternfly/react-topology';
import { PFBadges, PFBadgeType } from 'components/Pf/PfBadges';
import { config } from 'config';
import {
  BoxByType,
  CytoscapeGlobalScratchData,
  DecoratedGraphNodeData,
  GraphType,
  NodeType,
  UNKNOWN
} from 'types/Graph';

export type NodeMap = Map<string, NodeModel>;

export type GraphPFSettings = CytoscapeGlobalScratchData;

export const getNodeShape = (data: DecoratedGraphNodeData): NodeShape => {
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

export const getNodeLabel = (nodeData: DecoratedGraphNodeData, nodes: NodeMap, settings: GraphPFSettings): string => {
  const app = nodeData.app || '';
  const cluster = nodeData.cluster;
  const namespace = nodeData.namespace;
  const nodeType = nodeData.nodeType;
  const service = nodeData.service || '';
  const version = nodeData.version || '';
  const workload = nodeData.workload || '';
  const isBox = nodeData.isBox;
  const isBoxed = nodeData.parent;
  let box1Type, box2Type: string | undefined;
  if (isBoxed) {
    let box1, box2: NodeModel | undefined;
    box1 = nodes[nodeData.parent!];
    const box1Data = box1.data as DecoratedGraphNodeData;
    box1Type = box1Data.isBox;
    box2 = box1Data.parent ? nodes[box1Data.parent!] : undefined;
    box2Type = box2 ? (box2.data as DecoratedGraphNodeData).isBox : undefined;
  }
  const isAppBoxed = box1Type === BoxByType.APP;
  const isNamespaceBoxed = box1Type === BoxByType.NAMESPACE || box2Type === BoxByType.NAMESPACE;
  const isMultiNamespace = settings.activeNamespaces.length > 1;
  const isOutside = nodeData.isOutside;

  // Badges portion of label...

  let badges = [] as string[];
  if (settings.showMissingSidecars && nodeData.hasMissingSC) {
    badges.push('MS');
  }
  if (settings.showVirtualServices) {
    if (nodeData.hasCB) {
      badges.push('CB');
    }
    // If there's an additional traffic scenario present then it's assumed
    // that there is a VS present so the VS badge is omitted.
    if (nodeData.hasVS) {
      const hasKialiScenario =
        nodeData.hasFaultInjection ||
        nodeData.hasMirroring ||
        nodeData.hasRequestRouting ||
        nodeData.hasRequestTimeout ||
        nodeData.hasTCPTrafficShifting ||
        nodeData.hasTrafficShifting;
      if (!hasKialiScenario) {
        badges.push('VS');
      } else {
        if (nodeData.hasFaultInjection) {
          badges.push('FI');
        }
        if (nodeData.hasMirroring) {
          badges.push('MI');
        }
        if (nodeData.hasTrafficShifting || nodeData.hasTCPTrafficShifting) {
          badges.push('TS');
        }
        if (nodeData.hasRequestTimeout) {
          badges.push('RT');
        }
        if (nodeData.hasRequestRouting) {
          badges.push('RR');
        }
      }
    }

    if (nodeData.hasWorkloadEntry) {
      badges.push('WE');
    }
    if (nodeData.isRoot) {
      if (
        nodeData.isGateway?.ingressInfo?.hostnames?.length !== undefined ||
        nodeData.isGateway?.gatewayAPIInfo?.hostnames?.length !== undefined
      ) {
        badges.push('GW');
      }
      badges.push('TS');
    } else {
      if (nodeData.isGateway?.egressInfo?.hostnames?.length !== undefined) {
        badges.push('GW');
      }
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
  if (!!cluster && cluster !== UNKNOWN && cluster !== settings.homeCluster && !isBoxed && isBox !== BoxByType.CLUSTER) {
    content.push(`(${cluster})`);
  }

  switch (nodeType) {
    case NodeType.AGGREGATE:
      content.unshift(nodeData.aggregateValue!);
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
          content.unshift(nodeData.cluster);
          break;
        case BoxByType.NAMESPACE:
          content.unshift(nodeData.namespace);
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

    // TODO add in pfBadge
    return content.join('\n');
  }

  let hosts: string[] = [];
  nodeData.hasVS?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
  nodeData.isGateway?.ingressInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
  nodeData.isGateway?.egressInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));
  nodeData.isGateway?.gatewayAPIInfo?.hostnames?.forEach(h => hosts.push(h === '*' ? '* (all hosts)' : h));

  let htmlHosts = '';
  if (hosts.length !== 0) {
    let hostsToShow = hosts;
    if (hostsToShow.length > config.graph.maxHosts) {
      hostsToShow = hosts.slice(0, config.graph.maxHosts);
      hostsToShow.push(
        hosts.length - config.graph.maxHosts === 1
          ? '1 more host...'
          : `${hosts.length - config.graph.maxHosts} more hosts...`
      );
    }
    htmlHosts = hostsToShow.join('\n');
  }

  // TODO add in badges, fix hosts stuff
  return `${content.join('\n')}\n${htmlHosts}`;
};
