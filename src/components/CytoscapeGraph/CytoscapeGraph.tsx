import * as React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import ReactResizeDetector from 'react-resize-detector';

import { GraphHighlighter } from './graphs/GraphHighlighter';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import * as GraphBadge from './graphs/GraphBadge';
import TrafficRender from './graphs/TrafficRenderer';
import EmptyGraphLayout from './EmptyGraphLayout';
import CytoscapeReactWrapper from './CytoscapeReactWrapper';

import { ServiceGraphActions } from '../../actions/ServiceGraphActions';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import {
  CytoscapeBaseEvent,
  CytoscapeClickEvent,
  CytoscapeMouseInEvent,
  CytoscapeMouseOutEvent,
  GraphParamsType,
  CytoscapeGlobalScratchNamespace,
  CytoscapeGlobalScratchData
} from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import { authentication } from '../../utils/Authentication';
import * as H from '../../utils/Health';
import { NamespaceHealth } from '../../types/Health';

import { makeServiceGraphUrlFromParams } from '../Nav/NavUtils';

type CytoscapeGraphType = {
  elements?: any;
  edgeLabelMode: EdgeLabelMode;
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
  private updateLayout: boolean;
  private resetSelection: boolean;
  private initialValues: InitialValues;
  private cy: any;

  constructor(props: CytoscapeGraphProps) {
    super(props);
    this.updateLayout = false;
    this.initialValues = {
      position: undefined,
      zoom: undefined
    };
  }

  shouldComponentUpdate(nextProps: CytoscapeGraphProps, nextState: CytoscapeGraphState) {
    this.updateLayout =
      this.props.graphLayout !== nextProps.graphLayout ||
      this.props.namespace.name !== nextProps.namespace.name ||
      (this.props.elements !== nextProps.elements &&
        this.elementsNeedRelayout(this.props.elements, nextProps.elements));
    this.resetSelection = this.props.namespace.name !== nextProps.namespace.name;
    return (
      this.props.namespace.name !== nextProps.namespace.name ||
      this.props.graphLayout !== nextProps.graphLayout ||
      this.props.edgeLabelMode !== nextProps.edgeLabelMode ||
      this.props.showNodeLabels !== nextProps.showNodeLabels ||
      this.props.showCircuitBreakers !== nextProps.showCircuitBreakers ||
      this.props.showVirtualServices !== nextProps.showVirtualServices ||
      this.props.showMissingSidecars !== nextProps.showMissingSidecars ||
      this.props.elements !== nextProps.elements ||
      this.props.showTrafficAnimation !== nextProps.showTrafficAnimation ||
      this.props.isError !== nextProps.isError
    );
  }

  componentDidMount() {
    this.cyInitialization(this.getCy());
  }

  componentDidUpdate(prevProps: CytoscapeGraphProps, prevState: CytoscapeGraphState) {
    const cy = this.getCy();
    this.processGraphUpdate(cy);
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
          <CytoscapeReactWrapper
            ref={e => {
              this.setCytoscapeReactWrapperRef(e);
            }}
          />
        </EmptyGraphLayout>
      </div>
    );
  }

  private getCy() {
    return this.cytoscapeReactWrapperRef ? this.cytoscapeReactWrapperRef.getCy() : null;
  }

  private setCytoscapeReactWrapperRef(cyRef: any) {
    this.cytoscapeReactWrapperRef = cyRef;
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
    this.updateLayout = true;

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
      this.processGraphUpdate(cy);
    });

    cy.on('destroy', (evt: any) => {
      this.trafficRenderer.stop();
      this.cy = undefined;
    });
  }

  private safeFit(cy: any) {
    cy.fit();
    if (cy.zoom() > 2.5) {
      cy.zoom(2.5);
      cy.center();
    }
    this.initialValues.position = { ...cy.pan() };
    this.initialValues.zoom = cy.zoom();
  }

  private processGraphUpdate(cy: any) {
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
      showNodeLabels: this.props.showNodeLabels,
      versioned: this.props.versioned
    };
    cy.scratch(CytoscapeGlobalScratchNamespace, globalScratchData);

    cy.startBatch();

    // Destroy badges
    // We must destroy all badges before updating the json, or else we will lose all the
    // references to removed nodes
    const cbBadge = new GraphBadge.CircuitBreakerBadge();
    const vsBadge = new GraphBadge.VirtualServiceBadge();
    const vsGroupBadge = new GraphBadge.VirtualServiceGroupBadge();
    const msBadge = new GraphBadge.MissingSidecarsBadge();
    cy.nodes().forEach(ele => {
      cbBadge.destroyBadge(ele);
      vsBadge.destroyBadge(ele);
      vsGroupBadge.destroyBadge(ele);
      msBadge.destroyBadge(ele);
    });

    // update the entire set of nodes and edges to keep the graph up-to-date
    cy.json({ elements: this.props.elements });

    // update the layout if needed and reset to default values
    if (this.updateLayout) {
      // Reset all the nodes positions from previous layouts to avoid the next layout to use these as suggestions
      cy.nodes().forEach(node => {
        node.position({ x: 0, y: 0 });
      });
      // Enable labels when doing a relayout, layouts can be told to take into account the labels to avoid
      // overlap, but we need to have them enabled (nodeDimensionsIncludeLabels: true)
      this.turnNodeLabelsTo(cy, true);
      cy.layout(LayoutDictionary.getLayout(this.props.graphLayout)).run();
    }

    // Create and destroy labels
    this.turnNodeLabelsTo(cy, this.props.showNodeLabels);

    // Create badges
    cy.nodes().forEach(ele => {
      if (this.props.showCircuitBreakers && ele.data('hasCB')) {
        cbBadge.buildBadge(ele);
      }
      if (this.props.showVirtualServices && ele.data('hasVS')) {
        if (ele.data('isGroup')) {
          vsGroupBadge.buildBadge(ele);
        } else {
          vsBadge.buildBadge(ele);
        }
      }
      if (this.props.showMissingSidecars && ele.data('hasMissingSC') && !ele.data('isGroup')) {
        msBadge.buildBadge(ele);
      }
    });

    cy.endBatch();

    // We need to fit outside of the batch operation for it to take effect on the new nodes
    if (this.updateLayout) {
      this.safeFit(cy);
      this.updateLayout = false;
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
    if (!event.summaryTarget.data('isOutside')) {
      return;
    }

    this.context.router.history.push(
      makeServiceGraphUrlFromParams({
        namespace: { name: event.summaryTarget.data('service').split('.')[1] },
        graphLayout: this.props.graphLayout,
        graphDuration: this.props.graphDuration,
        edgeLabelMode: this.props.edgeLabelMode,
        graphType: this.props.graphType,
        versioned: this.props.versioned
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

  // To know if we should re-layout, we need to know if any element changed
  // Do a quick round by comparing the number of nodes and edges, if different
  // a change is expected.
  // If we have the same number of elements, compare the ids, if we find one that isn't
  // in the other, we can be sure that there are changes.
  // Worst case is when they are the same, avoid that.
  private elementsNeedRelayout(prevElements: any, nextElements: any) {
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
    const healthPerNamespace = new Map<String, Promise<NamespaceHealth>>();
    // Asynchronously fetch health
    cy.nodes().forEach(ele => {
      const fqService = ele.data('service');
      if (fqService && (ele.data('isGroup') || !ele.data('parent'))) {
        const serviceParts = fqService.split('.');
        if (serviceParts.length < 2) {
          // Ignore health for special nodes such as "unknown"
          return;
        }
        const service = serviceParts[0];
        const namespace = serviceParts[1];
        let promise = healthPerNamespace.get(namespace);
        if (!promise) {
          promise = API.getNamespaceHealth(authentication(), namespace, duration).then(r => r.data);
          healthPerNamespace.set(namespace, promise);
        }
        ele.data('healthPromise', promise.then(nsHealth => nsHealth[service]));
        promise
          .then(nsHealth => {
            const health = nsHealth[service];
            const status = H.computeAggregatedHealth(health);
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
    });
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  showNodeLabels: state.serviceGraph.filterState.showNodeLabels,
  showCircuitBreakers: state.serviceGraph.filterState.showCircuitBreakers,
  showVirtualServices: state.serviceGraph.filterState.showVirtualServices,
  showMissingSidecars: state.serviceGraph.filterState.showMissingSidecars,
  showTrafficAnimation: state.serviceGraph.filterState.showTrafficAnimation,
  elements: state.serviceGraph.graphData,
  isLoading: state.serviceGraph.isLoading,
  isError: state.serviceGraph.isError
});

const mapDispatchToProps = (dispatch: any) => ({
  onClick: (event: CytoscapeClickEvent) => dispatch(ServiceGraphActions.showSidePanelInfo(event)),
  onReady: (cy: any) => dispatch(ServiceGraphActions.graphRendered(cy))
});

const CytoscapeGraphConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(CytoscapeGraph);
export default CytoscapeGraphConnected;
