import * as React from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';

import { GraphHighlighter } from './graphs/GraphHighlighter';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import EmptyGraphLayout from './EmptyGraphLayout';
import CytoscapeReactWrapper from './CytoscapeReactWrapper';

import { GraphParamsType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import { KialiAppState } from '../../store/Store';
import * as GraphBadge from './graphs/GraphBadge';
import TrafficRender from './graphs/TrafficRenderer';
import { ServiceGraphActions } from '../../actions/ServiceGraphActions';

type CytoscapeGraphType = {
  elements?: any;
  edgeLabelMode: EdgeLabelMode;
  showNodeLabels: boolean;
  showCircuitBreakers: boolean;
  showRouteRules: boolean;
  showMissingSidecars: boolean;
  showTrafficAnimation: boolean;
  onClick: (event: CytoscapeClickEvent) => void;
  onReady: (cytoscapeRef: any) => void;
  refresh: any;
};

type CytoscapeGraphProps = CytoscapeGraphType & GraphParamsType;

type CytoscapeGraphState = {};

interface CytoscapeBaseEvent {
  summaryType: string; // what the summary panel should show. One of: graph, node, edge, or group
  summaryTarget: any; // the cytoscape element that was the target of the event
}

export interface CytoscapeClickEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseInEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseOutEvent extends CytoscapeBaseEvent {}

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
  private cy: any;

  constructor(props: CytoscapeGraphProps) {
    super(props);
    this.updateLayout = false;
  }

  shouldComponentUpdate(nextProps: any, nextState: any) {
    this.updateLayout =
      this.props.graphLayout !== nextProps.graphLayout ||
      (this.props.elements !== nextProps.elements &&
        this.elementsNeedRelayout(this.props.elements, nextProps.elements));
    return (
      this.props.graphLayout !== nextProps.graphLayout ||
      this.props.edgeLabelMode !== nextProps.edgeLabelMode ||
      this.props.showNodeLabels !== nextProps.showNodeLabels ||
      this.props.showCircuitBreakers !== nextProps.showCircuitBreakers ||
      this.props.showRouteRules !== nextProps.showRouteRules ||
      this.props.showMissingSidecars !== nextProps.showMissingSidecars ||
      this.props.elements !== nextProps.elements ||
      this.props.graphLayout !== nextProps.graphLayout ||
      this.props.showTrafficAnimation !== nextProps.showTrafficAnimation
    );
  }

  componentDidMount() {
    this.cyInitialization(this.getCy());
  }

  componentDidUpdate() {
    this.processGraphUpdate(this.getCy());
  }

  render() {
    return (
      <div id="cytoscape-container" style={{ marginRight: '25em', height: '100%' }}>
        <EmptyGraphLayout
          elements={this.props.elements}
          namespace={this.props.namespace.name}
          action={this.props.refresh}
        >
          <CytoscapeReactWrapper
            ref={e => {
              this.setCytoscapeReactWrapperRef(e);
            }}
            elements={this.props.elements}
            layout={this.props.graphLayout}
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

  private turnEdgeLabelsTo = (cy: any, value: EdgeLabelMode) => {
    cy.edges().forEach(edge => {
      edge.data('edgeLabelMode', value);
    });
  };

  private turnNodeLabelsTo = (cy: any, value: boolean) => {
    cy.nodes().forEach(node => {
      node.data('showNodeLabels', value);
    });
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

    cy.on('tap', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.handleTap(cytoscapeEvent);
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
    cy.ready((evt: any) => {
      this.props.onReady(evt.cy);
      this.processGraphUpdate(cy);
    });

    cy.on('destroy', (evt: any) => {
      this.trafficRenderer.stop();
      this.cy = undefined;
    });
  }

  private processGraphUpdate(cy: any) {
    if (!cy) {
      return;
    }

    this.trafficRenderer.stop();

    const isTheGraphSelected = cy.$(':selected').length === 0;

    cy.startBatch();

    // Destroy badges
    // We must destroy all badges before updating the json, or else we will lose all the
    // references to removed nodes
    const cbBadge = new GraphBadge.CircuitBreakerBadge();
    const rrBadge = new GraphBadge.RouteRuleBadge();
    const rrGroupBadge = new GraphBadge.RouteRuleGroupBadge();
    const msBadge = new GraphBadge.MissingSidecarsBadge();
    cy.nodes().forEach(ele => {
      cbBadge.destroyBadge(ele);
      rrBadge.destroyBadge(ele);
      rrGroupBadge.destroyBadge(ele);
      msBadge.destroyBadge(ele);
    });

    // update the entire set of nodes and edges to keep the graph up-to-date
    cy.json({ elements: this.props.elements });

    // update the layout if needed
    if (this.updateLayout) {
      cy.layout(LayoutDictionary.getLayout(this.props.graphLayout)).run();
      // Don't allow a large zoom if the graph has a few nodes (nodes would look too big).
      if (cy.zoom() > 2.5) {
        cy.zoom(2.5);
        cy.center();
      }
      this.updateLayout = false;
    }

    // Create and destroy labels
    this.turnEdgeLabelsTo(cy, this.props.edgeLabelMode);
    this.turnNodeLabelsTo(cy, this.props.showNodeLabels);

    // Create badges
    cy.nodes().forEach(ele => {
      if (this.props.showCircuitBreakers && ele.data('hasCB') === 'true') {
        cbBadge.buildBadge(ele);
      }
      if (this.props.showRouteRules && ele.data('hasRR') === 'true') {
        if (ele.data('isGroup')) {
          rrGroupBadge.buildBadge(ele);
        } else {
          rrBadge.buildBadge(ele);
        }
      }
      if (this.props.showMissingSidecars && ele.data('hasMissingSidecars') && !ele.data('isGroup')) {
        msBadge.buildBadge(ele);
      }
    });

    cy.endBatch();

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
}

const mapStateToProps = (state: KialiAppState) => ({
  showNodeLabels: state.serviceGraph.filterState.showNodeLabels,
  showCircuitBreakers: state.serviceGraph.filterState.showCircuitBreakers,
  showRouteRules: state.serviceGraph.filterState.showRouteRules,
  showMissingSidecars: state.serviceGraph.filterState.showMissingSidecars,
  showTrafficAnimation: state.serviceGraph.filterState.showTrafficAnimation,
  elements: state.serviceGraph.graphData
});

const mapDispatchToProps = (dispatch: any) => ({
  onClick: (event: CytoscapeClickEvent) => dispatch(ServiceGraphActions.showSidePanelInfo(event)),
  onReady: (cy: any) => dispatch(ServiceGraphActions.graphRendered(cy))
});

const CytoscapeGraphConnected = connect(mapStateToProps, mapDispatchToProps)(CytoscapeGraph);
export default CytoscapeGraphConnected;
