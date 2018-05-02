import * as React from 'react';
import { connect } from 'react-redux';
import { Spinner } from 'patternfly-react';
import PropTypes from 'prop-types';

import { GraphStyles } from './graphs/GraphStyles';
import { GraphHighlighter } from './graphs/GraphHighlighter';
import ReactCytoscape from './ReactCytoscape';
import EmptyGraphLayout from './EmptyGraphLayout';

import { GraphParamsType } from '../../types/Graph';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import { KialiAppState } from '../../store/Store';
import * as GraphBadge from './graphs/GraphBadge';

type CytoscapeLayoutType = {
  elements: any;
  onClick: (event: CytoscapeClickEvent) => void;
  onReady: (event: CytoscapeBaseEvent) => void;
  isLoading?: boolean;
  showEdgeLabels: boolean;
  showNodeLabels: boolean;
  isReady?: boolean;
  refresh: any;
};

type CytoscapeLayoutProps = CytoscapeLayoutType & GraphParamsType;

type CytoscapeLayoutState = {};

interface CytoscapeBaseEvent {
  summaryType: string;
  summaryTarget: any;
}

export interface CytoscapeClickEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseInEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseOutEvent extends CytoscapeBaseEvent {}

// @todo: Move this class to 'containers' folder -- but it effects many other things
// exporting this class for testing
export class CytoscapeLayout extends React.Component<CytoscapeLayoutProps, CytoscapeLayoutState> {
  static contextTypes = {
    router: PropTypes.object
  };

  cy: any;
  graphHighlighter: GraphHighlighter;

  constructor(props: CytoscapeLayoutProps) {
    super(props);

    console.log(`Starting ServiceGraphPage for namespace: ${this.props.namespace.name}`);
  }

  shouldComponentUpdate(nextProps: any, nextState: any) {
    return (
      this.props.isLoading !== nextProps.isLoading ||
      this.props.graphLayout !== nextProps.graphLayout ||
      this.props.badgeStatus !== nextProps.badgeStatus ||
      this.props.showEdgeLabels !== nextProps.showEdgeLabels ||
      this.props.showNodeLabels !== nextProps.showNodeLabels
    );
  }

  turnEdgeLabelsTo = (value: boolean) => {
    let elements = this.props.elements;
    if (elements && elements.edges) {
      // Mutate the edges inplace
      elements.edges.forEach(edge => {
        edge.data.showEdgeLabels = value;
      });
    }
  };

  turnNodeLabelsTo = (value: boolean) => {
    let elements = this.props.elements;
    if (elements && elements.nodes) {
      // Mutate the nodes inplace
      elements.nodes.forEach(node => {
        node.data.showNodeLabels = value;
      });
    }
  };

  cyRef(cy: any) {
    this.cy = cy;
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

    this.cy.on('tap', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.handleTap(cytoscapeEvent);
      }
    });

    // when the graph is fully populated and ready, we need to add appropriate badges to the nodes
    this.cy.ready((evt: any) => {
      if (this.props.badgeStatus.hideCBs && this.props.badgeStatus.hideRRs) {
        return;
      }

      const cbBadge = new GraphBadge.CircuitBreakerBadge();
      const rrBadge = new GraphBadge.RouteRuleBadge();
      evt.cy.nodes().forEach(ele => {
        if (!this.props.badgeStatus.hideCBs && ele.data('hasCB') === 'true') {
          cbBadge.buildBadge(ele);
        }
        if (!this.props.badgeStatus.hideRRs && ele.data('hasRR') === 'true') {
          rrBadge.buildBadge(ele);
        }
      });

      // Don't allow a large zoom if the graph has a few nodes (nodes would look too big).
      if (this.cy.zoom() > 2.5) {
        this.cy.zoom(2.5);
        this.cy.center();
      }
    });

    this.cy.on('mouseover', 'node,edge', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.handleMouseIn(cytoscapeEvent);
      }
    });
    this.cy.on('mouseout', 'node,edge', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent) {
        this.handleMouseOut(cytoscapeEvent);
      }
    });
    this.cy.ready((evt: any) => {
      if (!this.props.isReady) {
        this.props.onReady(evt.cy);
      }
    });
  }

  render() {
    const layout = LayoutDictionary.getLayout(this.props.graphLayout);

    this.turnEdgeLabelsTo(this.props.showEdgeLabels);
    this.turnNodeLabelsTo(this.props.showNodeLabels);

    return (
      <div id="cytoscape-container" style={{ marginRight: '25em', height: '100%' }}>
        <Spinner loading={this.props.isLoading}>
          <EmptyGraphLayout
            elements={this.props.elements}
            namespace={this.props.namespace.name}
            action={this.props.refresh}
          >
            <ReactCytoscape
              containerID="cy"
              cyRef={cy => {
                this.cyRef(cy);
              }}
              elements={this.props.elements}
              style={GraphStyles.styles()}
              cytoscapeOptions={GraphStyles.options()}
              layout={layout}
            />
          </EmptyGraphLayout>
        </Spinner>
      </div>
    );
  }

  handleTap = (event: CytoscapeClickEvent) => {
    this.props.onClick(event);
    this.graphHighlighter.onClick(event);
  };

  handleMouseIn = (event: CytoscapeMouseInEvent) => {
    this.graphHighlighter.onMouseIn(event);
  };

  handleMouseOut = (event: CytoscapeMouseOutEvent) => {
    this.graphHighlighter.onMouseOut(event);
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  showEdgeLabels: state.serviceGraphState.showEdgeLabels,
  showNodeLabels: state.serviceGraphState.showNodeLabels
});

const CytoscapeLayoutConnected = connect(mapStateToProps, null)(CytoscapeLayout);
export default CytoscapeLayoutConnected;
