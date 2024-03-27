import {
  ComponentFactory,
  ContextMenuItem,
  GraphComponent,
  GraphElement,
  ModelKind,
  nodeDragSourceSpec,
  withContextMenu,
  withDragNode,
  withPanZoom,
  withSelection
} from '@patternfly/react-topology';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { clickHandler, ContextMenuOption, getOptions } from 'components/CytoscapeGraph/ContextMenu/NodeContextMenu';
import * as React from 'react';
import { StyleEdge } from '../styles/styleEdge';
import { StyleGroup } from '../styles/styleGroup';
import { StyleNode } from '../styles/styleNode';
import { BoxByType, DecoratedGraphNodeData, NodeParamsType, NodeType } from 'types/Graph';
import * as AlertUtils from '../../../utils/AlertUtils';
import { MessageType } from 'types/MessageCenter';
import { store } from 'store/ConfigStore';
import { NamespaceActions } from 'actions/NamespaceAction';
import { GraphUrlParams, makeNodeGraphUrlFromParams } from 'components/Nav/NavUtils';
import { history } from '../../../app/History';
import { GraphNodeDoubleTapEvent } from 'components/CytoscapeGraph/CytoscapeGraph';
import { serverConfig } from '../../../config';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';

type ContextMenuOptionPF = ContextMenuOption & {
  altClickHandler?: (node: GraphElement, kiosk: string) => void;
  node?: GraphElement;
};

const doubleTapHandler = (node: GraphElement, kiosk: string) => {
  handleDoubleTap(node, kiosk);
};

const nodeContextMenu = (node: GraphElement, kiosk: string): React.ReactElement[] => {
  const options = getOptions(node.getData());
  const optionsPF = options.map(o => o as ContextMenuOptionPF);
  const nodeData = node.getData() as DecoratedGraphNodeData;
  if (
    !(
      nodeData.isInaccessible ||
      nodeData.isServiceEntry ||
      (nodeData.nodeType === NodeType.BOX && nodeData.isBox !== BoxByType.APP)
    )
  ) {
    optionsPF.unshift(
      nodeData.isOutside
        ? ({
            text: 'Namespace Graph',
            altClickHandler: doubleTapHandler,
            external: false,
            node: node,
            target: '',
            url: ''
          } as ContextMenuOptionPF)
        : ({
            text: 'Node Graph',
            altClickHandler: doubleTapHandler,
            external: false,
            node: node,
            target: '',
            url: ''
          } as ContextMenuOptionPF)
    );
  }

  const items = optionsPF.map((o, i) => {
    return (
      // TODO: fix kiosk param
      !!o.altClickHandler ? (
        <ContextMenuItem key={`option-${i}`} onClick={() => o.altClickHandler!(o.node!, kiosk)}>
          {o.text}
        </ContextMenuItem>
      ) : (
        <ContextMenuItem key={`option-${i}`} onClick={() => clickHandler(o, kiosk)}>
          {o.text} {o.target === '_blank' && <ExternalLinkAltIcon />}
        </ContextMenuItem>
      )
    );
  });

  return items;
};

// This is temporary until the PFT graph properly handles DoubleTap.  Until then
// we offer a ContextMenu option for what would normally be handled via DoubleTap.
const handleDoubleTap = (doubleTapNode: GraphElement, kiosk: string) => {
  const dtNodeData = doubleTapNode.getData() as DecoratedGraphNodeData;
  const graphData = doubleTapNode.getGraph().getData().graphData;

  if (
    dtNodeData.isInaccessible ||
    dtNodeData.isServiceEntry ||
    (dtNodeData.nodeType === NodeType.BOX && dtNodeData.isBox !== BoxByType.APP)
  ) {
    return;
  }

  if (dtNodeData.isOutOfMesh) {
    if (!serverConfig.ambientEnabled) {
      AlertUtils.add(
        `A node with a missing sidecar provides no node-specific telemetry and can not provide a node detail graph.`,
        undefined,
        MessageType.WARNING
      );
    } else {
      AlertUtils.add(
        `A node out of the mesh provides no node-specific telemetry and can not provide a node detail graph.`,
        undefined,
        MessageType.WARNING
      );
    }

    return;
  }
  if (dtNodeData.isIdle) {
    AlertUtils.add(
      `An idle node has no node-specific traffic and can not provide a node detail graph.`,
      undefined,
      MessageType.WARNING
    );
    return;
  }
  if (dtNodeData.isOutside) {
    store.dispatch(NamespaceActions.setActiveNamespaces([{ name: dtNodeData.namespace }]));
    return;
  }

  // If graph is in the drilled-down view, there is the chance that the user
  // double clicked the same node as in the full graph. Determine if this is
  // the case.
  let sameNode = false;
  const node = graphData.fetchParams.node;
  if (node) {
    sameNode = node && node.nodeType === dtNodeData.nodeType;
    switch (dtNodeData.nodeType) {
      case NodeType.AGGREGATE:
        sameNode = sameNode && node.aggregate === dtNodeData.aggregate;
        sameNode = sameNode && node.aggregateValue === dtNodeData.aggregateValue;
        break;
      case NodeType.APP:
        sameNode = sameNode && node.app === dtNodeData.app;
        sameNode = sameNode && node.version === dtNodeData.version;
        break;
      case NodeType.BOX:
        // we only support node graphs on app boxes, so assume app box
        sameNode = sameNode && node.app === dtNodeData.app;
        break;
      case NodeType.SERVICE:
        sameNode = sameNode && node.service === dtNodeData.service;
        break;
      case NodeType.WORKLOAD:
        sameNode = sameNode && node.workload === dtNodeData.workload;
        break;
      default:
        sameNode = true; // don't navigate to unsupported node type
    }
  }

  const { app, cluster, namespace, nodeType, service, version, workload } = dtNodeData;
  const event = { app, cluster, namespace, nodeType, service, version, workload } as GraphNodeDoubleTapEvent;
  const targetNode: NodeParamsType = { ...event, namespace: { name: dtNodeData.namespace } };

  // If, while in the drilled-down graph, the user double clicked the same
  // node as in the main graph, it doesn't make sense to re-load the same view.
  // Instead, assume that the user wants more details for the node and do a
  // redirect to the details page.
  if (sameNode) {
    handleDoubleTapSameNode(targetNode, kiosk);
    return;
  }

  // In case user didn't double-tap the same node, or if graph is in
  // full graph mode, redirect to the drilled-down graph of the chosen node.
  const state = store.getState();
  const urlParams: GraphUrlParams = {
    activeNamespaces: graphData.fetchParams.namespaces,
    duration: graphData.fetchParams.duration,
    edgeLabels: graphData.fetchParams.edgeLabels,
    edgeMode: state.graph.edgeMode,
    graphLayout: state.graph.layout,
    graphType: graphData.fetchParams.graphType,
    namespaceLayout: state.graph.namespaceLayout,
    node: targetNode,
    refreshInterval: state.userSettings.refreshInterval,
    showIdleEdges: state.graph.toolbarState.showIdleEdges,
    showIdleNodes: state.graph.toolbarState.showIdleNodes,
    showOperationNodes: state.graph.toolbarState.showOperationNodes,
    showServiceNodes: state.graph.toolbarState.showServiceNodes,
    trafficRates: graphData.fetchParams.trafficRates
  };

  // To ensure updated components get the updated URL, update the URL first and then the state
  const nodeGraphUrl = makeNodeGraphUrlFromParams(urlParams, true);

  if (isParentKiosk(kiosk)) {
    kioskContextMenuAction(nodeGraphUrl);
  } else {
    history.push(nodeGraphUrl);
  }
};

// This allows us to navigate to the service details page when zoomed in on nodes
const handleDoubleTapSameNode = (targetNode: NodeParamsType, kiosk: string) => {
  const makeAppDetailsPageUrl = (namespace: string, nodeType: string, name?: string): string => {
    return `/namespaces/${namespace}/${nodeType}/${name}`;
  };
  const nodeType = targetNode.nodeType;
  let urlNodeType = targetNode.nodeType + 's';
  let name = targetNode.app;
  if (nodeType === 'service') {
    name = targetNode.service;
  } else if (nodeType === 'workload') {
    name = targetNode.workload;
  } else {
    urlNodeType = 'applications';
  }

  const detailsPageUrl = makeAppDetailsPageUrl(targetNode.namespace.name, urlNodeType, name);

  if (isParentKiosk(kiosk)) {
    kioskContextMenuAction(detailsPageUrl);
  } else {
    history.push(detailsPageUrl);
  }
};

export const stylesComponentFactory: ComponentFactory = (
  kind: ModelKind,
  type: string
): React.FunctionComponent<any> | undefined => {
  const kiosk = store.getState().globalState.kiosk;

  switch (kind) {
    case ModelKind.edge:
      return withSelection({ multiSelect: false, controlled: false })(StyleEdge as any);
    case ModelKind.graph:
      return withPanZoom()(GraphComponent);
    case ModelKind.node: {
      return withDragNode(nodeDragSourceSpec('node', true, true))(
        withContextMenu(e => nodeContextMenu(e, kiosk))(
          withSelection({ multiSelect: false, controlled: false })((type === 'group' ? StyleGroup : StyleNode) as any)
        )
      );
    }
    default:
      return undefined;
  }
};
