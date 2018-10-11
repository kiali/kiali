import * as React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactResizeDetector from 'react-resize-detector';

import { GraphHighlighter } from './graphs/GraphHighlighter';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import TrafficRender from './TrafficAnimation/TrafficRenderer';
import EmptyGraphLayout from '../../containers/EmptyGraphLayoutContainer';
import { CytoscapeReactWrapper } from './CytoscapeReactWrapper';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';

import { GraphActions } from '../../actions/GraphActions';
import * as API from '../../services/Api';
import { store } from '../../store/ConfigStore';
import { KialiAppState } from '../../store/Store';
import {
  CytoscapeBaseEvent,
  CytoscapeClickEvent,
  CytoscapeMouseInEvent,
  CytoscapeMouseOutEvent,
  GraphParamsType,
  CytoscapeGlobalScratchNamespace,
  CytoscapeGlobalScratchData,
  NodeParamsType,
  NodeType
} from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import * as H from '../../types/Health';
import { authentication } from '../../utils/Authentication';
import { NamespaceAppHealth, NamespaceServiceHealth, NamespaceWorkloadHealth } from '../../types/Health';

import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../Nav/NavUtils';

type CytoscapeGraphType = {
  elements?: any;
  edgeLabelMode: EdgeLabelMode;
  node?: NodeParamsType; // node for initial selection
  showNodeLabels: boolean;
  showCircuitBreakers: boolean;
  showVirtualServices: boolean;
  showMissingSidecars: boolean;
  showSecurity: boolean;
  showServiceNodes: boolean;
  showTrafficAnimation: boolean;
  showUnusedNodes: boolean;
  onReady: (cytoscapeRef: any) => void;
  onClick: (event: CytoscapeClickEvent) => void;
  onDoubleClick: (event: CytoscapeClickEvent) => void;
  refresh: any;
};

type CytoscapeGraphProps = CytoscapeGraphType &
  GraphParamsType & {
    isLoading: boolean;
    isError: boolean;
    containerClassName?: string;
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

// @todo: Move this class to 'containers' folder -- but it effects many other things
// exporting this class for testing
export class CytoscapeGraph extends React.Component<CytoscapeGraphProps, CytoscapeGraphState> {
  static contextTypes = {
    router: PropTypes.object
  };
  // for dbl-click support
  static doubleTapMs = 350;
  static tapTarget: any;
  static tapTimeout: any;

  private graphHighlighter: GraphHighlighter;
  private trafficRenderer: TrafficRender;
  private cytoscapeReactWrapperRef: any;
  private namespaceChanged: boolean;
  private nodeChanged: boolean;
  private resetSelection: boolean;
  private initialValues: InitialValues;
  private cy: any;

  constructor(props: CytoscapeGraphProps) {
    super(props);
    this.namespaceChanged = false;
    this.nodeChanged = false;
    this.initialValues = {
      position: undefined,
      zoom: undefined
    };
    this.cytoscapeReactWrapperRef = React.createRef();
  }

  shouldComponentUpdate(nextProps: CytoscapeGraphProps, nextState: CytoscapeGraphState) {
    this.namespaceChanged = this.namespaceChanged || this.props.namespace.name !== nextProps.namespace.name;
    this.nodeChanged = this.nodeChanged || this.props.node !== nextProps.node;
    this.resetSelection = this.props.namespace.name !== nextProps.namespace.name;
    let result =
      this.props.namespace.name !== nextProps.namespace.name ||
      this.props.node !== nextProps.node ||
      this.props.graphLayout !== nextProps.graphLayout ||
      this.props.edgeLabelMode !== nextProps.edgeLabelMode ||
      this.props.showNodeLabels !== nextProps.showNodeLabels ||
      this.props.showCircuitBreakers !== nextProps.showCircuitBreakers ||
      this.props.showVirtualServices !== nextProps.showVirtualServices ||
      this.props.showMissingSidecars !== nextProps.showMissingSidecars ||
      this.props.showSecurity !== nextProps.showSecurity ||
      this.props.showServiceNodes !== nextProps.showServiceNodes ||
      this.props.showTrafficAnimation !== nextProps.showTrafficAnimation ||
      this.props.showUnusedNodes !== nextProps.showUnusedNodes ||
      this.props.elements !== nextProps.elements ||
      this.props.isError !== nextProps.isError;

    if (!nextProps.elements || !nextProps.elements.nodes || nextProps.elements.nodes.length < 1) {
      result = true;
    }

    return result;
  }

  componentDidMount() {
    this.cyInitialization(this.getCy());
  }

  componentDidUpdate(prevProps: CytoscapeGraphProps, prevState: CytoscapeGraphState) {
    const cy = this.getCy();
    if (!cy) {
      return;
    }

    let updateLayout = false;
    if (
      this.nodeNeedsRelayout() ||
      this.namespaceNeedsRelayout(prevProps.elements, this.props.elements) ||
      this.elementsNeedRelayout(prevProps.elements, this.props.elements) ||
      this.props.graphLayout.name !== prevProps.graphLayout.name
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
        this.selectTarget(eles[0]);
        this.props.onClick({ summaryType: eles[0].data('isGroup') ? 'group' : 'node', summaryTarget: eles[0] });
      }
    }
    if (this.props.elements !== prevProps.elements) {
      this.updateHealth(cy);
    }
  }

  render() {
    return (
      <div id="cytoscape-container" className={this.props.containerClassName}>
        <ReactResizeDetector handleWidth={true} handleHeight={true} skipOnMount={true} onResize={this.onResize} />
        <EmptyGraphLayout
          elements={this.props.elements}
          namespace={this.props.namespace.name}
          action={this.props.refresh}
          isLoading={this.props.isLoading}
          isError={this.props.isError}
        >
          <CytoscapeReactWrapper ref={e => this.setCytoscapeReactWrapperRef(e)} />
        </EmptyGraphLayout>
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

    this.graphHighlighter = new GraphHighlighter(cy);
    this.trafficRenderer = new TrafficRender(cy, cy.edges());

    const getCytoscapeBaseEvent = (event: any): CytoscapeBaseEvent | null => {
      const target = event.target;
      if (target === cy) {
        return { summaryType: 'graph', summaryTarget: cy };
      } else if (target.isNode()) {
        if (target.data('isGroup') === 'version') {
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

    cy.on('layoutstop', (evt: any) => {
      // Don't allow a large zoom if the graph has a few nodes (nodes would look too big).
      this.safeFit(cy);
    });

    cy.ready((evt: any) => {
      this.props.onReady(evt.cy);
      this.processGraphUpdate(cy, true);
    });

    cy.on('destroy', (evt: any) => {
      this.trafficRenderer.stop();
      this.cy = undefined;
    });
  }

  private safeFit(cy: any) {
    CytoscapeGraphUtils.safeFit(cy);
    this.initialValues.position = { ...cy.pan() };
    this.initialValues.zoom = cy.zoom();
  }

  private processGraphUpdate(cy: any, updateLayout: boolean) {
    if (!cy) {
      return;
    }

    this.trafficRenderer.stop();

    const isTheGraphSelected = cy.$(':selected').length === 0;
    if (this.resetSelection) {
      if (!isTheGraphSelected) {
        this.selectTarget(null);
        this.handleTap({ summaryType: 'graph', summaryTarget: cy });
      }
      this.resetSelection = false;
    }

    const globalScratchData: CytoscapeGlobalScratchData = {
      edgeLabelMode: this.props.edgeLabelMode,
      graphType: this.props.graphType,
      showCircuitBreakers: this.props.showCircuitBreakers,
      showMissingSidecars: this.props.showMissingSidecars,
      showSecurity: this.props.showSecurity,
      showNodeLabels: this.props.showNodeLabels,
      showVirtualServices: this.props.showVirtualServices
    };
    cy.scratch(CytoscapeGlobalScratchNamespace, globalScratchData);

    cy.startBatch();

    // Note, to resolve some layout issues for KIALI-1291 we introduced a complete wipe of cy elements prior to a layout change. This
    // caused the issue in KIALI-1649. I'm not sure we still need the wipe, my testing shows good behavior without wiping the existing
    // elements. So, I'm commenting it out.  If we need to re-instate it then we need to also add a fix for 1649. For that we'd probably
    // need to gather the elements that have added classes (like Health info) and also capture any selected element. Then re-apply the
    // settings on the replacement elements, for those elements that still exist.
    // if (updateLayout) {
    //   cy.remove(cy.elements());
    // }

    // update the entire set of nodes and edges to keep the graph up-to-date
    cy.json({ elements: this.props.elements });

    if (updateLayout) {
      // Enable labels when doing a relayout, layouts can be told to take into account the labels to avoid
      // overlap, but we need to have them enabled (nodeDimensionsIncludeLabels: true)
      this.turnNodeLabelsTo(cy, true);
      cy.layout(LayoutDictionary.getLayout(this.props.graphLayout)).run();
    }

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
    this.trafficRenderer.setEdges(cy.edges());
    if (this.props.showTrafficAnimation) {
      this.trafficRenderer.start();
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

  private handleDoubleTap = (event: CytoscapeClickEvent) => {
    const target = event.summaryTarget;
    const targetType = event.summaryType;
    if (targetType !== 'node' && targetType !== 'group') {
      return;
    }

    if (target.data('isOutside')) {
      if (!target.data('isInaccessible')) {
        store.dispatch(GraphActions.changed());
        this.context.router.history.push(
          makeNamespaceGraphUrlFromParams({
            namespace: { name: target.data('namespace') },
            graphLayout: this.props.graphLayout,
            graphDuration: this.props.graphDuration,
            edgeLabelMode: this.props.edgeLabelMode,
            graphType: this.props.graphType,
            injectServiceNodes: this.props.injectServiceNodes
          })
        );
      }
      return;
    }

    const nodeType = target.data('nodeType');
    const workload = target.data('workload');
    const app = target.data('app');
    const version = targetType === 'group' ? undefined : event.summaryTarget.data('version');
    const service = target.data('service');
    const targetNode: NodeParamsType = {
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
    store.dispatch(GraphActions.changed());
    this.context.router.history.push(
      makeNodeGraphUrlFromParams(targetNode, {
        namespace: { name: event.summaryTarget.data('namespace') },
        graphLayout: this.props.graphLayout,
        graphDuration: this.props.graphDuration,
        edgeLabelMode: this.props.edgeLabelMode,
        graphType: this.props.graphType,
        injectServiceNodes: this.props.injectServiceNodes
      })
    );
  };

  private handleTap = (event: CytoscapeClickEvent) => {
    this.props.onClick(event);
    this.graphHighlighter.onClick(event);
  };

  private handleMouseIn = (event: CytoscapeMouseInEvent) => {
    this.graphHighlighter.onMouseIn(event);
  };

  private handleMouseOut = (event: CytoscapeMouseOutEvent) => {
    this.graphHighlighter.onMouseOut(event);
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
    const duration = this.props.graphDuration.value;
    // Keep a map of namespace x promises in order not to fetch several times the same data per namespace
    const appHealthPerNamespace = new Map<String, Promise<NamespaceAppHealth>>();
    const serviceHealthPerNamespace = new Map<String, Promise<NamespaceServiceHealth>>();
    const workloadHealthPerNamespace = new Map<String, Promise<NamespaceWorkloadHealth>>();
    // Asynchronously fetch health
    cy.nodes().forEach(ele => {
      const inaccessible = ele.data('isInaccessible');
      if (inaccessible) {
        return;
      }
      const namespace = ele.data('namespace');
      const nodeType = ele.data('nodeType');
      const workload = ele.data('workload');
      const workloadOk = workload && workload !== '' && workload !== 'unknown';
      // use workload health when workload is set and valid (workload nodes or versionApp nodes)
      const useWorkloadHealth = nodeType === NodeType.WORKLOAD || (nodeType === NodeType.APP && workloadOk);

      if (useWorkloadHealth) {
        let promise = workloadHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceWorkloadHealth(authentication(), namespace, duration);
          workloadHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, workload);
      } else if (nodeType === NodeType.APP) {
        const app = ele.data('app');
        let promise = appHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceAppHealth(authentication(), namespace, duration);
          appHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, app);
      } else if (nodeType === NodeType.SERVICE) {
        const service = ele.data('service');
        let promise = serviceHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceServiceHealth(authentication(), namespace, duration);
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
        const health = nsHealth[key];
        const status = health.getGlobalStatus();
        ele.removeClass(H.DEGRADED.name + ' ' + H.FAILURE.name);
        if (status === H.DEGRADED || status === H.FAILURE) {
          ele.addClass(status.name);
        }
      })
      .catch(err => {
        ele.removeClass(H.DEGRADED.name + ' ' + H.FAILURE.name);
        console.error(API.getErrorMsg('Could not fetch health [' + key + ']', err));
      });
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  showNodeLabels: state.graph.filterState.showNodeLabels,
  showCircuitBreakers: state.graph.filterState.showCircuitBreakers,
  showVirtualServices: state.graph.filterState.showVirtualServices,
  showMissingSidecars: state.graph.filterState.showMissingSidecars,
  showSecurity: state.graph.filterState.showSecurity,
  showServiceNodes: state.graph.filterState.showServiceNodes,
  showTrafficAnimation: state.graph.filterState.showTrafficAnimation,
  showUnusedNodes: state.graph.filterState.showUnusedNodes,
  elements: state.graph.graphData,
  isLoading: state.graph.isLoading,
  isError: state.graph.isError
});

const mapDispatchToProps = (dispatch: any) => ({
  onClick: (event: CytoscapeClickEvent) => dispatch(GraphActions.showSidePanelInfo(event)),
  onReady: (cy: any) => dispatch(GraphActions.graphRendered(cy))
});

const CytoscapeGraphConnected = connect(
  mapStateToProps,
  mapDispatchToProps,
  null,
  { withRef: true } // Allows to use getWrappedInstance to get the ref
)(CytoscapeGraph);
export default CytoscapeGraphConnected;
