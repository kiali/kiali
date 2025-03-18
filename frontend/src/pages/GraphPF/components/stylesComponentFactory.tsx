import {
  ComponentFactory,
  GraphComponent,
  GraphElement,
  ModelKind,
  nodeDragSourceSpec,
  withAreaSelection,
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
import { router } from '../../../app/History';
import { isMultiCluster, serverConfig } from '../../../config';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';
import * as API from '../../../services/Api';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { filterAutogeneratedGateways, getGatewaysAsList, PeerAuthentication } from 'types/IstioObjects';
import { ServiceWizardActionsDropdownGroup } from 'components/IstioWizards/ServiceWizardActionsDropdownGroup';
import { WizardAction, WizardMode } from 'components/IstioWizards/WizardActions';
import { ServiceDetailsInfo } from 'types/ServiceInfo';
import { kialiStyle } from 'styles/StyleUtils';
import { DropdownGroup, DropdownItem } from '@patternfly/react-core';
import { getGVKTypeString } from '../../../utils/IstioConfigUtils';
import { gvkType } from '../../../types/IstioConfigList';

type ContextMenuOptionPF = ContextMenuOption & {
  altClickHandler?: (node: GraphElement, kiosk: string) => void;
  node?: GraphElement;
};

const graphNavHandler = (node: GraphElement, kiosk: string): void => {
  handleGraphNav(node, kiosk);
};

const promises = new PromisesRegistry();

const nodeContextMenu = (node: GraphElement, kiosk: string): Promise<React.ReactElement[]> => {
  const items: JSX.Element[] = [];
  const nodeData = node.getData() as DecoratedGraphNodeData;

  if (nodeData.isInaccessible) {
    return Promise.resolve([]);
  }

  const options = getOptions(nodeData);
  const optionsPF = options.map(o => o as ContextMenuOptionPF);

  if (!(nodeData.isServiceEntry || (nodeData.nodeType === NodeType.BOX && nodeData.isBox !== BoxByType.APP))) {
    optionsPF.unshift(
      nodeData.isOutside
        ? ({
            text: 'Namespace Graph',
            altClickHandler: graphNavHandler,
            external: false,
            node: node,
            target: '',
            url: ''
          } as ContextMenuOptionPF)
        : ({
            text: 'Node Graph',
            altClickHandler: graphNavHandler,
            external: false,
            node: node,
            target: '',
            url: ''
          } as ContextMenuOptionPF)
    );
  }

  const contextMenuStyle = kialiStyle({
    paddingTop: 0,
    paddingBottom: 0
  });

  const menuOptions = optionsPF.map((o, i) => {
    return (
      // TODO: fix kiosk param
      !!o.altClickHandler ? (
        <DropdownItem
          className={contextMenuStyle}
          key={`option-${i}`}
          onClick={() => o.altClickHandler!(o.node!, kiosk)}
        >
          {o.text}
        </DropdownItem>
      ) : (
        <DropdownItem className={contextMenuStyle} key={`option-${i}`} onClick={() => clickHandler(o, kiosk)}>
          {o.text} {o.target === '_blank' && <ExternalLinkAltIcon />}
        </DropdownItem>
      )
    );
  });

  if (menuOptions.length > 0) {
    items.push(<DropdownGroup key={`group_show`} label={'Show'} children={menuOptions} />);
  }

  if (nodeData.nodeType !== NodeType.SERVICE) {
    // Add margin bottom if the service wizard is not added
    items.push(<div style={{ marginBottom: '0.5rem' }}></div>);

    return Promise.resolve(items);
  }

  const getDetailPromise = promises.register(
    'getDetailPromise',
    API.getServiceDetail(nodeData.namespace, nodeData.service!, false, nodeData.cluster)
  );
  const getGwPromise = promises.register(
    'getGwPromise',
    API.getAllIstioConfigs([getGVKTypeString(gvkType.Gateway)], false, '', '', nodeData.cluster)
  );
  const getPeerAuthsPromise = promises.register(
    'getPeerAuthsPromise',
    API.getIstioConfig(
      nodeData.namespace,
      [getGVKTypeString(gvkType.PeerAuthentication)],
      false,
      '',
      '',
      nodeData.cluster
    )
  );

  return new Promise<React.ReactElement[]>((resolve, reject) => {
    Promise.all([getDetailPromise, getGwPromise, getPeerAuthsPromise])
      .then(results => {
        const serviceDetails = results[0];
        const gateways = getGatewaysAsList(
          filterAutogeneratedGateways(results[1].data.resources[getGVKTypeString(gvkType.Gateway)])
        ).sort();
        const peerAuthentications = results[2].data.resources[getGVKTypeString(gvkType.PeerAuthentication)];

        items.push(
          <ServiceWizardActionsDropdownGroup
            className={contextMenuStyle}
            destinationRules={serviceDetails.destinationRules ?? []}
            istioPermissions={serviceDetails.istioPermissions}
            k8sHTTPRoutes={serviceDetails.k8sHTTPRoutes ?? []}
            k8sGRPCRoutes={serviceDetails.k8sGRPCRoutes ?? []}
            onAction={(key: WizardAction, mode: WizardMode): void =>
              handleLaunchWizard(key, mode, node, serviceDetails, gateways, peerAuthentications)
            }
            onDelete={(key): void => handleDeleteTrafficRouting(key, node, serviceDetails)}
            virtualServices={serviceDetails.virtualServices ?? []}
          />
        );
        resolve(items);
      })
      .catch(error => {
        if (error.isCanceled) {
          return;
        }
        reject(error);
      });
  });
};

const handleLaunchWizard = (
  key: WizardAction,
  mode: WizardMode,
  node: GraphElement,
  serviceDetails: ServiceDetailsInfo,
  gateways: string[],
  peerAuthentications: PeerAuthentication[]
): void => {
  node
    .getGraph()
    .getData()
    .onLaunchWizard(key, mode, node.getData().namespace, serviceDetails, gateways, peerAuthentications);
};

const handleDeleteTrafficRouting = (key: string, node: GraphElement, serviceDetails: ServiceDetailsInfo): void => {
  node.getGraph().getData().onDeleteTrafficRouting(key, serviceDetails);
};

const handleGraphNav = (fromNode: GraphElement, kiosk: string): void => {
  const fromNodeData = fromNode.getData() as DecoratedGraphNodeData;
  const graphData = fromNode.getGraph().getData().graphData;

  if (
    fromNodeData.isInaccessible ||
    fromNodeData.isServiceEntry ||
    (fromNodeData.nodeType === NodeType.BOX && fromNodeData.isBox !== BoxByType.APP)
  ) {
    return;
  }

  if (fromNodeData.isOutOfMesh) {
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
  if (fromNodeData.isIdle) {
    AlertUtils.add(
      `An idle node has no node-specific traffic and can not provide a node detail graph.`,
      undefined,
      MessageType.WARNING
    );
    return;
  }
  if (fromNodeData.isOutside) {
    store.dispatch(NamespaceActions.setActiveNamespaces([{ name: fromNodeData.namespace }]));
    return;
  }

  // If graph is in the drilled-down view, there is the chance that the user
  // selected the same node as in the full graph. Determine if this is the case.
  // note = this may not be a concern in PF graph, but I'm not sure...
  let sameNode = false;
  const node = graphData.fetchParams.node;
  if (node) {
    sameNode = node && node.nodeType === fromNodeData.nodeType;
    switch (fromNodeData.nodeType) {
      case NodeType.AGGREGATE:
        sameNode = sameNode && node.aggregate === fromNodeData.aggregate;
        sameNode = sameNode && node.aggregateValue === fromNodeData.aggregateValue;
        break;
      case NodeType.APP:
        sameNode = sameNode && node.app === fromNodeData.app;
        sameNode = sameNode && node.version === fromNodeData.version;
        break;
      case NodeType.BOX:
        // we only support node graphs on app boxes, so assume app box
        sameNode = sameNode && node.app === fromNodeData.app;
        break;
      case NodeType.SERVICE:
        sameNode = sameNode && node.service === fromNodeData.service;
        break;
      case NodeType.WORKLOAD:
        sameNode = sameNode && node.workload === fromNodeData.workload;
        break;
      default:
        sameNode = true; // don't navigate to unsupported node type
    }
  }

  const { app, cluster, namespace, nodeType, service, version, workload } = fromNodeData;
  const event = { app, cluster, namespace, nodeType, service, version, workload } as any;
  const targetNode: NodeParamsType = { ...event, namespace: { name: fromNodeData.namespace } };

  // If, while in the drilled-down graph, the user selected the same
  // node as in the main graph, it doesn't make sense to re-load the same view.
  // Instead, assume that the user wants more details for the node and do a
  // redirect to the details page.
  if (sameNode) {
    handleSameNode(targetNode, kiosk);
    return;
  }

  // In case user didn't select the same node, or if graph is in
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
    showWaypoints: state.graph.toolbarState.showWaypoints,
    trafficRates: graphData.fetchParams.trafficRates
  };

  // To ensure updated components get the updated URL, update the URL first and then the state
  const nodeGraphUrl = makeNodeGraphUrlFromParams(urlParams);

  if (isParentKiosk(kiosk)) {
    kioskContextMenuAction(nodeGraphUrl);
  } else {
    router.navigate(nodeGraphUrl);
  }
};

// This allows us to navigate to the service details page when zoomed in on nodes
const handleSameNode = (targetNode: NodeParamsType, kiosk: string): void => {
  const makeAppDetailsPageUrl = (namespace: string, nodeType: string, name?: string): string => {
    return `/namespaces/${namespace}/${nodeType}/${name}`;
  };
  const nodeType = targetNode.nodeType;
  let urlNodeType = `${targetNode.nodeType}s`;
  let name = targetNode.app;

  if (nodeType === 'service') {
    name = targetNode.service;
  } else if (nodeType === 'workload') {
    name = targetNode.workload;
  } else {
    urlNodeType = 'applications';
  }

  let detailsPageUrl = makeAppDetailsPageUrl(targetNode.namespace.name, urlNodeType, name);

  if (targetNode.cluster && isMultiCluster) {
    detailsPageUrl = `${detailsPageUrl}?clusterName=${targetNode.cluster}`;
  }

  if (isParentKiosk(kiosk)) {
    kioskContextMenuAction(detailsPageUrl);
  } else {
    router.navigate(detailsPageUrl);
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
      return withSelection({ multiSelect: false, controlled: false })(
        withPanZoom()(withAreaSelection(['ctrlKey', 'shiftKey'])(GraphComponent))
      );
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
