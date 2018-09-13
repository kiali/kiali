import * as React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactResizeDetector from 'react-resize-detector';

import { GraphHighlighter } from './graphs/GraphHighlighter';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import TrafficRender from './graphs/TrafficRenderer';
import EmptyGraphLayout from '../../containers/EmptyGraphLayoutContainer';
import { CytoscapeReactWrapper } from './CytoscapeReactWrapper';
import * as CytoscapeGraphUtils from './CytoscapeGraphUtils';

import { GraphActions } from '../../actions/GraphActions';
import * as API from '../../services/Api';
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
import { NamespaceAppHealth, NamespaceWorkloadHealth } from '../../types/Health';

import { makeNamespaceGraphUrlFromParams, makeNodeGraphUrlFromParams } from '../Nav/NavUtils';

type CytoscapeGraphType = {
  elements?: any;
  edgeLabelMode: EdgeLabelMode;
  node?: NodeParamsType; // node for initial selection
  showNodeLabels: boolean;
  showCircuitBreakers: boolean;
  showVirtualServices: boolean;
  showMissingSidecars: boolean;
  showTrafficAnimation: boolean;
  onClick: (event: CytoscapeClickEvent) => void;
  onDoubleClick: (event: CytoscapeClickEvent) => void;
  onReady: (cytoscapeRef: any) => void;
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
    const result =
      this.props.namespace.name !== nextProps.namespace.name ||
      this.props.node !== nextProps.node ||
      this.props.graphLayout !== nextProps.graphLayout ||
      this.props.edgeLabelMode !== nextProps.edgeLabelMode ||
      this.props.showNodeLabels !== nextProps.showNodeLabels ||
      this.props.showCircuitBreakers !== nextProps.showCircuitBreakers ||
      this.props.showVirtualServices !== nextProps.showVirtualServices ||
      this.props.showMissingSidecars !== nextProps.showMissingSidecars ||
      this.props.elements !== nextProps.elements ||
      this.props.showTrafficAnimation !== nextProps.showTrafficAnimation ||
      this.props.isError !== nextProps.isError;
    return result;
  }

  componentDidMount() {
    this.cyInitialization(this.getCy());
  }

  componentDidUpdate(prevProps: CytoscapeGraphProps, prevState: CytoscapeGraphState) {
    const cy = this.getCy();
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
        default:
          selector = selector + "[workload = '" + node.workload + "']";
      }
      const eles = cy.nodes(selector);
      if (eles.length > 0) {
        this.selectTarget(eles[0]);
        this.props.onClick({ summaryType: 'node', summaryTarget: eles[0] });
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

    const injectDoubleTap = tapEventCallback => {
      let lastTap, tapTimeout;

      return (evt: any) => {
        const currentTap = evt.target;

        tapTimeout = setTimeout(() => (lastTap = undefined), 350);

        if (lastTap && currentTap === lastTap) {
          clearTimeout(tapTimeout);
          lastTap = undefined;
          currentTap.trigger('doubleTap');
        } else {
          lastTap = currentTap;

          tapEventCallback(evt);
        }
      };
    };

    cy.on(
      'tap',
      injectDoubleTap((evt: any) => {
        const cytoscapeEvent = getCytoscapeBaseEvent(evt);

        if (cytoscapeEvent) {
          this.handleTap(cytoscapeEvent);
          this.selectTarget(evt.target);
        }
      })
    );

    cy.on('doubleTap', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);

      if (cytoscapeEvent && cytoscapeEvent.summaryType === 'node') {
        this.handleDoubleTap(cytoscapeEvent);
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
      showNodeLabels: this.props.showNodeLabels,
      showVirtualServices: this.props.showVirtualServices
    };
    cy.scratch(CytoscapeGlobalScratchNamespace, globalScratchData);

    cy.startBatch();

    if (updateLayout) {
      // To get a more consistent layout, remove every node and start again (only when a relayout is a must)
      cy.remove(cy.elements());
    }

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
    if (event.summaryTarget.data('isOutside')) {
      this.context.router.history.push(
        makeNamespaceGraphUrlFromParams({
          namespace: { name: event.summaryTarget.data('namespace') },
          graphLayout: this.props.graphLayout,
          graphDuration: this.props.graphDuration,
          edgeLabelMode: this.props.edgeLabelMode,
          graphType: this.props.graphType,
          injectServiceNodes: this.props.injectServiceNodes
        })
      );
    } else {
      const nodeType = event.summaryTarget.data('nodeType');
      switch (event.summaryTarget.data('nodeType')) {
        case NodeType.APP:
        case NodeType.WORKLOAD:
          const node: NodeParamsType = {
            nodeType: nodeType,
            workload: event.summaryTarget.data('workload'),
            app: event.summaryTarget.data('app'),
            version: event.summaryTarget.data('version')
          };
          this.context.router.history.push(
            makeNodeGraphUrlFromParams(node, {
              namespace: { name: event.summaryTarget.data('namespace') },
              graphLayout: this.props.graphLayout,
              graphDuration: this.props.graphDuration,
              edgeLabelMode: this.props.edgeLabelMode,
              graphType: this.props.graphType,
              injectServiceNodes: this.props.injectServiceNodes
            })
          );
          break;
        default:
          return;
      }
    }
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
    const wkldHealthPerNamespace = new Map<String, Promise<NamespaceWorkloadHealth>>();
    // Asynchronously fetch health
    cy.nodes().forEach(ele => {
      const namespace = ele.data('namespace');
      const nodeType = ele.data('nodeType');
      const isInAppBox = nodeType === NodeType.APP && ele.data('parent');
      if (nodeType === NodeType.WORKLOAD || isInAppBox) {
        const workload = ele.data('workload');
        // Workload-based health
        let promise = wkldHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceWorkloadHealth(authentication(), namespace, duration);
          wkldHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, workload);
      } else if (nodeType === NodeType.APP) {
        const app = ele.data('app');
        // App-based health
        let promise = appHealthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceAppHealth(authentication(), namespace, duration);
          appHealthPerNamespace.set(namespace, promise);
        }
        this.updateNodeHealth(ele, promise, app);
      }
    });
  }

  private updateNodeHealth(ele: any, promise: Promise<H.NamespaceAppHealth | H.NamespaceWorkloadHealth>, key: string) {
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
        console.error(API.getErrorMsg('Could not fetch health', err));
      });
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  showNodeLabels: state.graph.filterState.showNodeLabels,
  showCircuitBreakers: state.graph.filterState.showCircuitBreakers,
  showVirtualServices: state.graph.filterState.showVirtualServices,
  showMissingSidecars: state.graph.filterState.showMissingSidecars,
  showTrafficAnimation: state.graph.filterState.showTrafficAnimation,
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
