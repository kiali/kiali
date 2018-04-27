import * as React from 'react';
import { Spinner } from 'patternfly-react';
import PropTypes from 'prop-types';

import { GraphStyles } from './graphs/GraphStyles';
import { GraphHighlighter } from './graphs/GraphHighlighter';
import ReactCytoscape from './ReactCytoscape';
import EmptyGraphLayout from './EmptyGraphLayout';

import { GraphParamsType } from '../../types/Graph';
import * as LayoutDictionary from './graphs/LayoutDictionary';
import * as GraphBadge from './graphs/GraphBadge';

type CytoscapeLayoutType = {
  elements: any;
  onClick: (event: CytoscapeClickEvent) => void;
  onReady: (event: CytoscapeBaseEvent) => void;
  isLoading?: boolean;
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

export default class CytoscapeLayout extends React.Component<CytoscapeLayoutProps, CytoscapeLayoutState> {
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
      this.props.badgeStatus !== nextProps.badgeStatus
    );
  }

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

      evt.cy.nodes().forEach(ele => {
        if (!this.props.badgeStatus.hideCBs && ele.data('hasCB') === 'true') {
          new GraphBadge.CircuitBreakerBadge(ele).buildBadge();
        }
        if (!this.props.badgeStatus.hideRRs && ele.data('hasRR') === 'true') {
          new GraphBadge.RouteRuleBadge(ele).buildBadge();
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
