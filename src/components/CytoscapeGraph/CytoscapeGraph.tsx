import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import ReactResizeDetector from 'react-resize-detector';

import history from '../../app/History';
import Namespace from '../../types/Namespace';
import { GraphHighlighter } from './graphs/GraphHighlighter';
import TrafficRender from './TrafficAnimation/TrafficRenderer';
import EmptyGraphLayoutContainer from '../EmptyGraphLayout';
import { CytoscapeReactWrapper } from './CytoscapeReactWrapper';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';
import { CyNode } from './CytoscapeGraphUtils';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { GraphActions } from '../../actions/GraphActions';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import {
  activeNamespacesSelector,
  durationSelector,
  edgeLabelModeSelector,
  graphDataSelector,
  graphTypeSelector,
  refreshIntervalSelector
} from '../../store/Selectors';
import {
  CyData,
  CytoscapeBaseEvent,
  CytoscapeClickEvent,
  CytoscapeGlobalScratchData,
  CytoscapeGlobalScratchNamespace,
  CytoscapeMouseInEvent,
  CytoscapeMouseOutEvent,
  DecoratedGraphElements,
  GraphType,
  NodeParamsType,
  NodeType
} from '../../types/Graph';
import { EdgeLabelMode, Layout } from '../../types/GraphFilter';
import * as H from '../../types/Health';
import { MessageType } from '../../types/MessageCenter';
import { NamespaceAppHealth, NamespaceServiceHealth, NamespaceWorkloadHealth } from '../../types/Health';
import { GraphUrlParams, makeNodeGraphUrlFromParams } from '../Nav/NavUtils';
import { NamespaceActions } from '../../actions/NamespaceAction';
import { DurationInSeconds, PollIntervalInMs } from '../../types/Common';
import GraphThunkActions from '../../actions/GraphThunkActions';
import * as MessageCenterUtils from '../../utils/MessageCenter';
import FocusAnimation from './FocusAnimation';
import { CytoscapeContextMenuWrapper, NodeContextMenuType, EdgeContextMenuType } from './CytoscapeContextMenu';

type ReduxProps = {
  activeNamespaces: Namespace[];
  duration: DurationInSeconds;
  elements?: DecoratedGraphElements;
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  layout: Layout;
  node?: NodeParamsType;
  refreshInterval: PollIntervalInMs;
  showCircuitBreakers: boolean;
  showMissingSidecars: boolean;
  showNodeLabels: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showUnusedNodes: boolean;
  showVirtualServices: boolean;
  onReady: (cytoscapeRef: any) => void;
  setActiveNamespaces: (namespace: Namespace[]) => void;
  setNode: (node?: NodeParamsType) => void;
  updateGraph: (cyData: CyData) => void;
  updateSummary: (event: CytoscapeClickEvent) => void;
};

type CytoscapeGraphProps = ReduxProps & {
  isLoading: boolean;
  isError: boolean;
  isMTLSEnabled: boolean;
  containerClassName?: string;
  refresh: () => void;
  focusSelector?: string;
  contextMenuNodeComponent?: NodeContextMenuType;
  contextMenuGroupComponent?: NodeContextMenuType;
  contextMenuEdgeComponent?: EdgeContextMenuType;
};

type CytoscapeGraphState = {};

type Position = {
  x: number;
  y: number;
};

type InitialValues = {
  position?: Position;
  zoom?: number;
};

// exporting this class for testing
export class CytoscapeGraph extends React.Component<CytoscapeGraphProps, CytoscapeGraphState> {
  static contextTypes = {
    router: () => null
  };
  // for dbl-click support
  static doubleTapMs = 350;
  static tapTarget: any;
  static tapTimeout: any;

  private graphHighlighter?: GraphHighlighter;
  private trafficRenderer?: TrafficRender;
  private focusAnimation?: FocusAnimation;
  private focusFinished: boolean;
  private cytoscapeReactWrapperRef: any;
  private contextMenuRef: React.RefObject<CytoscapeContextMenuWrapper>;
  private namespaceChanged: boolean;
  private nodeChanged: boolean;
  private resetSelection: boolean = false;
  private initialValues: InitialValues;
  private cy: any;

  constructor(props: CytoscapeGraphProps) {
    super(props);
    this.focusFinished = false;
    this.namespaceChanged = false;
    this.nodeChanged = false;
    this.initialValues = {
      position: undefined,
      zoom: undefined
    };
    this.cytoscapeReactWrapperRef = React.createRef();
    this.contextMenuRef = React.createRef<CytoscapeContextMenuWrapper>();
  }

  shouldComponentUpdate(nextProps: CytoscapeGraphProps, _nextState: CytoscapeGraphState) {
    this.nodeChanged = this.nodeChanged || this.props.node !== nextProps.node;
    let result =
      this.props.edgeLabelMode !== nextProps.edgeLabelMode ||
      this.props.elements !== nextProps.elements ||
      this.props.isError !== nextProps.isError ||
      this.props.layout !== nextProps.layout ||
      this.props.node !== nextProps.node ||
      this.props.showCircuitBreakers !== nextProps.showCircuitBreakers ||
      this.props.showMissingSidecars !== nextProps.showMissingSidecars ||
      this.props.showNodeLabels !== nextProps.showNodeLabels ||
      this.props.showSecurity !== nextProps.showSecurity ||
      this.props.showServiceNodes !== nextProps.showServiceNodes ||
      this.props.showTrafficAnimation !== nextProps.showTrafficAnimation ||
      this.props.showUnusedNodes !== nextProps.showUnusedNodes ||
      this.props.showVirtualServices !== nextProps.showVirtualServices;

    if (!nextProps.elements || !nextProps.elements.nodes || nextProps.elements.nodes.length < 1) {
      result = true;
    }

    return result;
  }

  componentDidMount() {
    this.cyInitialization(this.getCy());
  }

  componentDidUpdate(prevProps: CytoscapeGraphProps, _prevState: CytoscapeGraphState) {
    const cy = this.getCy();
    if (!cy) {
      return;
    }

    let updateLayout = false;
    if (
      this.nodeNeedsRelayout() ||
      this.namespaceNeedsRelayout(prevProps.elements, this.props.elements) ||
      this.elementsNeedRelayout(prevProps.elements, this.props.elements) ||
      this.props.layout.name !== prevProps.layout.name
    ) {
      updateLayout = true;
    }

    this.processGraphUpdate(cy, updateLayout);

    // pre-select node if provided
    const node = this.props.node;
    if (node && cy && cy.$(':selected').length === 0) {
      let selector = "[nodeType = '" + node.nodeType + "']";
      switch (node.nodeType) {
        case NodeType.APP:
          selector = selector + "[app = '" + node.app + "']";
          if (node.version && node.version !== 'unknown') {
            selector = selector + "[version = '" + node.version + "']";
          }
          break;
        case NodeType.SERVICE:
          selector = selector + "[service = '" + node.service + "']";
          break;
        default:
          selector = selector + "[workload = '" + node.workload + "']";
      }
      const eles = cy.nodes(selector);
      if (eles.length > 0) {
        this.selectTargetAndUpdateSummary(eles[0]);
      }
    }
    if (this.props.elements !== prevProps.elements) {
      this.updateHealth(cy);
    }

    this.props.updateGraph({ updateTimestamp: Date.now(), cyRef: cy });
  }

  render() {
    return (
      <div id="cytoscape-container" className={this.props.containerClassName}>
        <ReactResizeDetector handleWidth={true} handleHeight={true} skipOnMount={false} onResize={this.onResize} />
        <EmptyGraphLayoutContainer
          elements={this.props.elements}
          namespaces={this.props.activeNamespaces}
          action={this.props.refresh}
          isLoading={this.props.isLoading}
          isError={this.props.isError}
        >
          <CytoscapeContextMenuWrapper
            ref={this.contextMenuRef}
            edgeContextMenuContent={this.props.contextMenuEdgeComponent}
            nodeContextMenuContent={this.props.contextMenuNodeComponent}
            groupContextMenuContent={this.props.contextMenuGroupComponent}
          />
          <CytoscapeReactWrapper ref={e => this.setCytoscapeReactWrapperRef(e)} />
        </EmptyGraphLayoutContainer>
      </div>
    );
  }

  getCy() {
    return this.cytoscapeReactWrapperRef.current ? this.cytoscapeReactWrapperRef.current.getCy() : null;
  }

  private setCytoscapeReactWrapperRef(cyRef: any) {
    this.cytoscapeReactWrapperRef.current = cyRef;
    this.cyInitialization(this.getCy());
  }

  private onResize = () => {
    if (this.cy) {
      this.cy.resize();
      const currentPosition = this.cy.pan();
      const currentZoom = this.cy.zoom();
      if (
        this.initialValues.position &&
        this.initialValues.position.x === currentPosition.x &&
        this.initialValues.position.y === currentPosition.y &&
        this.initialValues.zoom === currentZoom
      ) {
        // There was a resize, but we are in the initial pan/zoom state, we can fit again.
        this.safeFit(this.cy);
      }
    }
  };

  private turnNodeLabelsTo = (cy: any, value: boolean) => {
    cy.scratch(CytoscapeGlobalScratchNamespace).showNodeLabels = value;
  };

  private cyInitialization(cy: any) {
    if (!cy) {
      return;
    }

    // Caches the cy instance that is currently in use.
    // If that cy instance is the same one we are being asked to initialize, do NOT initialize it again;
    // this would add duplicate callbacks and would screw up the graph highlighter. If, however,
    // we are being asked to initialize a different cy instance, we assume the current one is now obsolete
    // so we do want to initialize the new cy instance.
    if (this.cy === cy) {
      return;
    }
    this.cy = cy;

    this.contextMenuRef!.current!.connectCy(this.cy);

    this.graphHighlighter = new GraphHighlighter(cy);
    this.trafficRenderer = new TrafficRender(cy, cy.edges());

    const getCytoscapeBaseEvent = (event: any): CytoscapeBaseEvent | null => {
      const target = event.target;
      if (target === cy) {
        return { summaryType: 'graph', summaryTarget: cy };
      } else if (target.isNode()) {
        if (target.data(CyNode.isGroup)) {
          return { summaryType: 'group', summaryTarget: target };
        } else {
          return { summaryType: 'node', summaryTarget: target };
        }
      } else if (target.isEdge()) {
        return { summaryType: 'edge', summaryTarget: target };
      } else {
        console.log(`${event.type} UNHANDLED`);
        return null;
      }
    };

    cy.on('tap', (event: any) => {
      let tapped = event.target;
      if (CytoscapeGraph.tapTimeout) {
        // cancel any single-tap timer in progress
        clearTimeout(CytoscapeGraph.tapTimeout);
        CytoscapeGraph.tapTimeout = null;

        if (tapped === CytoscapeGraph.tapTarget) {
          // if we click the same target again, perform double-tap
          tapped = null;
          CytoscapeGraph.tapTarget = null;
          const cytoscapeEvent = getCytoscapeBaseEvent(event);
          if (cytoscapeEvent) {
            this.handleDoubleTap(cytoscapeEvent);
          }
        }
      }
      if (tapped) {
        // start single-tap timer
        CytoscapeGraph.tapTarget = tapped;
        CytoscapeGraph.tapTimeout = setTimeout(() => {
          // timer expired without a follow-up click, so perform single-tap
          CytoscapeGraph.tapTarget = null;
          const cytoscapeEvent = getCytoscapeBaseEvent(event);
          if (cytoscapeEvent) {
            this.handleTap(cytoscapeEvent);
            this.selectTarget(event.target);
          }
        }, CytoscapeGraph.doubleTapMs);
      }
    });
    cy.on('mouseover', 'node,edge', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.handleMouseIn(cytoscapeEvent);
      }
    });

    cy.on('mouseout', 'node,edge', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.handleMouseOut(cytoscapeEvent);
      }
    });

    cy.on('layoutstop', (_evt: any) => {
      // Don't allow a large zoom if the graph has a few nodes (nodes would look too big).
      this.safeFit(cy);
    });

    cy.ready((evt: any) => {
      this.props.onReady(evt.cy);
      this.processGraphUpdate(cy, true);
    });

    cy.on('destroy', (_evt: any) => {
      this.trafficRenderer!.stop();
      this.cy = undefined;
      this.props.updateSummary({ summaryType: 'graph', summaryTarget: undefined });
    });
  }

  private focus(cy: any, elements?: any) {
    // We only want to focus once, but allow the url to be shared.
    if (this.focusFinished) {
      return;
    }
    let focusElements = elements;
    if (!focusElements) {
      if (this.props.focusSelector) {
        const selectorResult = cy.$(this.props.focusSelector);
        if (!selectorResult.empty()) {
          focusElements = selectorResult;
        }
      }
    }

    if (focusElements) {
      // If there is only one, select it
      if (focusElements.length === 1) {
        this.selectTargetAndUpdateSummary(focusElements[0]);
      } else {
        // If we have many elements, try to check if a compound in this query contains everything, if so, select it.
        const compound = focusElements.filter('$node > node');
        if (compound && compound.length === 1 && focusElements.subtract(compound).same(compound.children())) {
          this.selectTargetAndUpdateSummary(compound[0]);
          focusElements = compound;
        }
      }

      // Start animation
      if (this.focusAnimation) {
        this.focusAnimation.stop();
      }
      this.focusAnimation = new FocusAnimation(cy);
      this.focusAnimation.onFinished(() => {
        this.focusFinished = true;
      });
      this.focusAnimation.start(focusElements);
    }
    return focusElements;
  }

  private safeFit(cy: any) {
    this.focus(cy);
    CytoscapeGraphUtils.safeFit(cy);
    this.initialValues.position = { ...cy.pan() };
    this.initialValues.zoom = cy.zoom();
  }

  private processGraphUpdate(cy: any, updateLayout: boolean) {
    if (!cy) {
      return;
    }

    this.trafficRenderer!.stop();

    const isTheGraphSelected = cy.$(':selected').length === 0;
    if (this.resetSelection) {
      if (!isTheGraphSelected) {
        this.selectTarget(null);
        this.handleTap({ summaryType: 'graph', summaryTarget: cy });
      }
      this.resetSelection = false;
    }

    const globalScratchData: CytoscapeGlobalScratchData = {
      activeNamespaces: this.props.activeNamespaces,
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      mtlsEnabled: this.props.isMTLSEnabled,
      showCircuitBreakers: this.props.showCircuitBreakers,
      showMissingSidecars: this.props.showMissingSidecars,
      showSecurity: this.props.showSecurity,
      showNodeLabels: this.props.showNodeLabels,
      showVirtualServices: this.props.showVirtualServices
    };
    cy.scratch(CytoscapeGlobalScratchNamespace, globalScratchData);

    cy.startBatch();

    // KIALI-1291 issue was caused because some layouts (can't tell if all) do reuse the existing positions.
    // We got some issues when changing from/to cola/cose, as the nodes started to get far away from each other.
    // Previously we deleted the nodes prior to a layout update, this was too much and it seems that only reseting the
    // positions to 0,0 makes the layout more predictable.
    if (updateLayout) {
      cy.nodes().positions({ x: 0, y: 0 });
    }

    // update the entire set of nodes and edges to keep the graph up-to-date
    cy.json({ elements: this.props.elements });

    cy.endBatch();

    if (updateLayout) {
      CytoscapeGraphUtils.runLayout(cy, this.props.layout);
    }

    cy.startBatch();
    // Create and destroy labels
    this.turnNodeLabelsTo(cy, this.props.showNodeLabels);

    cy.endBatch();

    // We need to fit outside of the batch operation for it to take effect on the new nodes
    if (updateLayout) {
      this.safeFit(cy);
    }

    // We opt-in for manual selection to be able to control when to select a node/edge
    // https://github.com/cytoscape/cytoscape.js/issues/1145#issuecomment-153083828
    cy.nodes().unselectify();
    cy.edges().unselectify();

    // Verify our current selection is still valid, if not, select the graph
    if (!isTheGraphSelected && cy.$(':selected').length === 0) {
      this.handleTap({ summaryType: 'graph', summaryTarget: cy });
    }

    // Update TrafficRenderer
    this.trafficRenderer!.setEdges(cy.edges());
    if (this.props.showTrafficAnimation) {
      this.trafficRenderer!.start();
    }
  }

  private selectTarget = (target: any) => {
    if (!target) {
      target = this.cy;
    }
    this.cy
      .$(':selected')
      .selectify()
      .unselect()
      .unselectify();
    if (target !== this.cy) {
      target
        .selectify()
        .select()
        .unselectify();
    }
  };

  private selectTargetAndUpdateSummary = (target: any) => {
    this.selectTarget(target);
    const event: CytoscapeClickEvent = {
      summaryType: target.data(CyNode.isGroup) ? 'group' : 'node',
      summaryTarget: target
    };
    this.props.updateSummary(event);
    this.graphHighlighter!.onClick(event);
  };

  private handleDoubleTap = (event: CytoscapeClickEvent) => {
    const target = event.summaryTarget;
    const targetType = event.summaryType;
    if (targetType !== 'node' && targetType !== 'group') {
      return;
    }

    const targetOrGroupChildren = targetType === 'group' ? target.descendants() : target;

    if (target.data(CyNode.isInaccessible) || target.data(CyNode.isServiceEntry)) {
      return;
    }

    if (targetOrGroupChildren.every(t => t.data(CyNode.hasMissingSC))) {
      MessageCenterUtils.add(
        `A node with a missing sidecar provides no node-specific telemetry and can not provide a node detail graph.`,
        undefined,
        MessageType.WARNING
      );
      return;
    }
    if (targetOrGroupChildren.every(t => t.data(CyNode.isUnused))) {
      MessageCenterUtils.add(
        `An unused node has no node-specific traffic and can not provide a node detail graph.`,
        undefined,
        MessageType.WARNING
      );
      return;
    }
    if (target.data(CyNode.isOutside)) {
      this.props.setActiveNamespaces([{ name: target.data(CyNode.namespace) }]);
      return;
    }

    const namespace = target.data(CyNode.namespace);
    const nodeType = target.data(CyNode.nodeType);
    const workload = target.data(CyNode.workload);
    const app = target.data(CyNode.app);
    const version = targetType === 'group' ? undefined : event.summaryTarget.data(CyNode.version);
    const service = target.data(CyNode.service);
    const targetNode: NodeParamsType = {
      namespace: { name: namespace },
      nodeType: nodeType,
      workload: workload,
      app: app,
      version: version,
      service: service
    };

    let sameNode = false;
    if (this.props.node) {
      sameNode = this.props.node && this.props.node.nodeType === nodeType;
      switch (nodeType) {
        case NodeType.APP:
          sameNode = sameNode && this.props.node.app === app;
          sameNode = sameNode && this.props.node.version === version;
          break;
        case NodeType.SERVICE:
          sameNode = sameNode && this.props.node.service === service;
          break;
        case NodeType.WORKLOAD:
          sameNode = sameNode && this.props.node.workload === workload;
          break;
        default:
          sameNode = true; // don't navigate to unsupported node type
      }
    }
    if (sameNode) {
      return;
    }
    const urlParams: GraphUrlParams = {
      activeNamespaces: this.props.activeNamespaces,
      duration: this.props.duration,
      edgeLabelMode: this.props.edgeLabelMode,
      graphLayout: this.props.layout,
      graphType: this.props.graphType,
      node: targetNode,
      refreshInterval: this.props.refreshInterval,
      showServiceNodes: this.props.showServiceNodes,
      showUnusedNodes: this.props.showUnusedNodes
    };

    // To ensure updated components get the updated URL, update the URL first and then the state
    history.push(makeNodeGraphUrlFromParams(urlParams));
    this.props.setNode(targetNode);
  };

  private handleTap = (event: CytoscapeClickEvent) => {
    this.props.updateSummary(event);
    this.graphHighlighter!.onClick(event);
  };

  private handleMouseIn = (event: CytoscapeMouseInEvent) => {
    this.graphHighlighter!.onMouseIn(event);
  };

  private handleMouseOut = (event: CytoscapeMouseOutEvent) => {
    this.graphHighlighter!.onMouseOut(event);
  };

  private namespaceNeedsRelayout(prevElements: any, nextElements: any) {
    const needsRelayout = this.namespaceChanged && prevElements !== nextElements;
    if (needsRelayout) {
      this.namespaceChanged = false;
    }
    return needsRelayout;
  }

  private nodeNeedsRelayout() {
    const needsRelayout = this.nodeChanged;
    if (needsRelayout) {
      this.nodeChanged = false;
    }
    return needsRelayout;
  }

  // Tests if the element is still in the current graph
  private isElementValid(ele: any) {
    return ele.cy() === this.cy;
  }

  // To know if we should re-layout, we need to know if any element changed
  // Do a quick round by comparing the number of nodes and edges, if different
  // a change is expected.
  // If we have the same number of elements, compare the ids, if we find one that isn't
  // in the other, we can be sure that there are changes.
  // Worst case is when they are the same, avoid that.
  private elementsNeedRelayout(prevElements: any, nextElements: any) {
    if (prevElements === nextElements) {
      return false;
    }
    if (
      !prevElements ||
      !nextElements ||
      !prevElements.nodes ||
      !prevElements.edges ||
      !nextElements.nodes ||
      !nextElements.edges ||
      prevElements.nodes.length !== nextElements.nodes.length ||
      prevElements.edges.length !== nextElements.edges.length
    ) {
      return true;
    }
    // If both have the same ids, we don't need to relayout
    return !(
      this.nodeOrEdgeArrayHasSameIds(nextElements.nodes, prevElements.nodes) &&
      this.nodeOrEdgeArrayHasSameIds(nextElements.edges, prevElements.edges)
    );
  }

  private nodeOrEdgeArrayHasSameIds(a: Array<any>, b: Array<any>) {
    const aIds = a.map(e => e.id).sort();
    return b
      .map(e => e.id)
      .sort()
      .every((eId, index) => eId === aIds[index]);
  }

  private updateHealth(cy: any) {
    if (!cy) {
      return;
    }
    const duration = this.props.duration;
    // Keep a map of namespace x promises in order not to fetch several times the same data per namespace
    const appHealthPerNamespace = new Map<string, Promise<NamespaceAppHealth>>();
    const serviceHealthPerNamespace = new Map<string, Promise<NamespaceServiceHealth>>();
    const workloadHealthPerNamespace = new Map<string, Promise<NamespaceWorkloadHealth>>();
    // Asynchronously fetch health
    cy.nodes().forEach(ele => {
      const inaccessible = ele.data(CyNode.isInaccessible);
      if (inaccessible) {
        return;
      }
      const namespace = ele.data(CyNode.namespace);
      const namespaceOk = namespace && namespace !== '' && namespace !== 'unknown';
      // incomplete telemetry can result in an unknown namespace, if so set nodeType UNKNOWN
      const nodeType = namespaceOk ? ele.data(CyNode.nodeType) : NodeType.UNKNOWN;
      const workload = ele.data(CyNode.workload);
      const workloadOk = workload && workload !== '' && workload !== 'unknown';
      // use workload health when workload is set and valid (workload nodes or versionApp nodes)
      const useWorkloadHealth = nodeType === NodeType.WORKLOAD || (nodeType === NodeType.APP && workloadOk);

      if (useWorkloadHealth) {
        let promise = workloadHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceWorkloadHealth(namespace, duration);
          workloadHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, workload);
      } else if (nodeType === NodeType.APP) {
        const app = ele.data(CyNode.app);
        let promise = appHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceAppHealth(namespace, duration);
          appHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, app);
        // TODO: If we want to block health checks for service entries, uncomment this (see kiali-2029)
        // } else if (nodeType === NodeType.SERVICE && !ele.data(CyNode.isServiceEntry)) {
      } else if (nodeType === NodeType.SERVICE) {
        const service = ele.data(CyNode.service);

        let promise = serviceHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceServiceHealth(namespace, duration);
          serviceHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, service);
      }
    });
  }

  private updateNodeHealth(
    ele: any,
    promise: Promise<H.NamespaceAppHealth | H.NamespaceServiceHealth | H.NamespaceWorkloadHealth>,
    key: string
  ) {
    ele.data('healthPromise', promise.then(nsHealth => nsHealth[key]));
    promise
      .then(nsHealth => {
        // Discard if the element is no longer valid
        if (this.isElementValid(ele)) {
          const health = nsHealth[key];
          if (health) {
            const status = health.getGlobalStatus();
            ele.removeClass(H.DEGRADED.name + ' ' + H.FAILURE.name);
            if (status === H.DEGRADED || status === H.FAILURE) {
              ele.addClass(status.name);
            }
          } else {
            ele.removeClass(`${H.DEGRADED.name}  ${H.FAILURE.name} ${H.HEALTHY.name}`);
            console.debug(`No health found for [${ele.data(CyNode.nodeType)}] [${key}]`);
          }
        }
      })
      .catch(err => {
        // Discard if the element is no longer valid
        if (this.isElementValid(ele)) {
          ele.removeClass(`${H.DEGRADED.name}  ${H.FAILURE.name} ${H.HEALTHY.name}`);
        }
        console.error(API.getErrorMsg(`Could not fetch health for [${ele.data(CyNode.nodeType)}] [${key}]`, err));
      });
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state),
  edgeLabelMode: edgeLabelModeSelector(state),
  elements: graphDataSelector(state),
  graphType: graphTypeSelector(state),
  isError: state.graph.isError,
  isLoading: state.graph.isLoading,
  layout: state.graph.layout,
  node: state.graph.node,
  refreshInterval: refreshIntervalSelector(state),
  showCircuitBreakers: state.graph.filterState.showCircuitBreakers,
  showMissingSidecars: state.graph.filterState.showMissingSidecars,
  showNodeLabels: state.graph.filterState.showNodeLabels,
  showSecurity: state.graph.filterState.showSecurity,
  showServiceNodes: state.graph.filterState.showServiceNodes,
  showTrafficAnimation: state.graph.filterState.showTrafficAnimation,
  showUnusedNodes: state.graph.filterState.showUnusedNodes,
  showVirtualServices: state.graph.filterState.showVirtualServices
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  onReady: (cy: any) => dispatch(GraphThunkActions.graphReady(cy)),
  setActiveNamespaces: (namespaces: Namespace[]) => dispatch(NamespaceActions.setActiveNamespaces(namespaces)),
  setNode: bindActionCreators(GraphActions.setNode, dispatch),
  updateGraph: (cyData: CyData) => dispatch(GraphActions.updateGraph(cyData)),
  updateSummary: (event: CytoscapeClickEvent) => dispatch(GraphActions.updateSummary(event))
});

const CytoscapeGraphContainer = connect(
  mapStateToProps,
  mapDispatchToProps,
  null,
  { withRef: true } // Allows to use getWrappedInstance to get the ref
)(CytoscapeGraph);
export default CytoscapeGraphContainer;
