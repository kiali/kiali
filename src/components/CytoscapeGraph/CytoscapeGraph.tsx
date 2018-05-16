import * as React from 'react';
import { connect } from 'react-redux';
import { Spinner } from 'patternfly-react';
import PropTypes from 'prop-types';

import { GraphHighlighter } from './graphs/GraphHighlighter';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import EmptyGraphLayout from './EmptyGraphLayout';
import CytoscapeReactWrapper from './CytoscapeReactWrapper';

import { GraphParamsType } from '../../types/Graph';
import { EdgeLabelMode } from '../../types/GraphFilter';
import { KialiAppState } from '../../store/Store';
import * as GraphBadge from './graphs/GraphBadge';

type CytoscapeGraphType = {
  elements?: any;
  isLoading?: boolean;
  edgeLabelMode: EdgeLabelMode;
  showNodeLabels: boolean;
  showCircuitBreakers: boolean;
  showRouteRules: boolean;
  showMissingSidecars: boolean;
  onClick: (event: CytoscapeClickEvent) => void;
  onReady: (event: CytoscapeBaseEvent) => void;
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
  private cytoscapeReactWrapperRef: any;
  private newLayout: any;

  constructor(props: CytoscapeGraphProps) {
    super(props);
    this.newLayout = '';
  }

  shouldComponentUpdate(nextProps: any, nextState: any) {
    this.newLayout = this.props.graphLayout !== nextProps.graphLayout ? nextProps.graphLayout : '';
    return (
      this.props.isLoading !== nextProps.isLoading ||
      this.props.graphLayout !== nextProps.graphLayout ||
      this.props.edgeLabelMode !== nextProps.edgeLabelMode ||
      this.props.showNodeLabels !== nextProps.showNodeLabels ||
      this.props.showCircuitBreakers !== nextProps.showCircuitBreakers ||
      this.props.showRouteRules !== nextProps.showRouteRules ||
      this.props.showMissingSidecars !== nextProps.showMissingSidecars ||
      this.props.elements !== nextProps.elements ||
      this.props.graphLayout !== nextProps.graphLayout
    );
  }

  componentDidMount() {
    console.log('CY: mounting graph component');
    this.cyInitialization(this.getCy());
  }

  componentDidUpdate() {
    console.log('CY: updating graph component');
    this.processGraphUpdate(this.getCy());
  }

  render() {
    console.log('CY: rendering graph component');

    return (
      <div id="cytoscape-container" style={{ marginRight: '25em', height: '100%' }}>
        <Spinner loading={this.props.isLoading}>
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
        </Spinner>
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

  private turnEdgeLabelsTo = (value: EdgeLabelMode) => {
    let elements = this.props.elements;
    if (elements && elements.edges) {
      elements.edges.forEach(edge => {
        edge.data.edgeLabelMode = value;
      });
    }
  };

  private turnNodeLabelsTo = (value: boolean) => {
    let elements = this.props.elements;
    if (elements && elements.nodes) {
      elements.nodes.forEach(node => {
        node.data.showNodeLabels = value;
      });
    }
  };

  private cyInitialization(cy: any) {
    if (!cy) {
      return;
    }

    // Conveniently, the graph highlighter caches the cy instance that is currently in use.
    // If that cy instance is the same one we are being asked to initialize, do NOT initialize it again;
    // this would add duplicate callbacks and would screw up the graph highlighter. If, however,
    // we are being asked to initialize a different cy instance, we assume the current one is now obsolete
    // so we do want to initialize the new cy instance.
    if (this.graphHighlighter && this.graphHighlighter.cy === cy) {
      return;
    }

    this.graphHighlighter = new GraphHighlighter(cy);

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
  }

  private processGraphUpdate(cy: any) {
    if (!cy) {
      return;
    }

    console.log('CY: graph is being updated');

    cy.startBatch();

    // update the entire set of nodes and edges to keep the graph up-to-date
    cy.json({ elements: this.props.elements });

    // update the layout if it changed
    if (this.newLayout) {
      cy.layout(LayoutDictionary.getLayout(this.newLayout)).run();
      this.newLayout = '';
    }

    // Create and destroy labels
    this.turnEdgeLabelsTo(this.props.edgeLabelMode);
    this.turnNodeLabelsTo(this.props.showNodeLabels);

    // Create and destroy badges
    const cbBadge = new GraphBadge.CircuitBreakerBadge();
    const rrBadge = new GraphBadge.RouteRuleBadge();
    const rrGroupBadge = new GraphBadge.RouteRuleGroupBadge();
    const msBadge = new GraphBadge.MissingSidecarsBadge();
    cy.nodes().forEach(ele => {
      if (this.props.showCircuitBreakers && ele.data('hasCB') === 'true') {
        cbBadge.buildBadge(ele);
      } else {
        cbBadge.destroyBadge(ele);
      }
      if (this.props.showRouteRules && ele.data('hasRR') === 'true') {
        if (ele.data('isGroup')) {
          rrGroupBadge.buildBadge(ele);
        } else {
          rrBadge.buildBadge(ele);
        }
      } else {
        rrBadge.destroyBadge(ele);
      }
      if (this.props.showMissingSidecars && ele.data('hasMissingSidecars') && !ele.data('isGroup')) {
        msBadge.buildBadge(ele);
      } else {
        msBadge.destroyBadge(ele);
      }
    });

    // Don't allow a large zoom if the graph has a few nodes (nodes would look too big).
    // TODO: only do this if there is a small number of nodes - let the user zoom in large graphs
    if (cy.zoom() > 2.5) {
      cy.zoom(2.5);
      cy.center();
    }

    cy.endBatch();
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
}

const mapStateToProps = (state: KialiAppState) => ({
  showNodeLabels: state.serviceGraphFilterState.showNodeLabels,
  showCircuitBreakers: state.serviceGraphFilterState.showCircuitBreakers,
  showRouteRules: state.serviceGraphFilterState.showRouteRules,
  showMissingSidecars: state.serviceGraphFilterState.showMissingSidecars,
  elements: state.serviceGraphDataState.graphData
});

const CytoscapeGraphConnected = connect(mapStateToProps, null)(CytoscapeGraph);
export default CytoscapeGraphConnected;
