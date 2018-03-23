import * as React from 'react';
import { Spinner, Button } from 'patternfly-react';
import PropTypes from 'prop-types';

import * as API from '../../services/Api';
import { GraphStyles } from './graphs/GraphStyles';
import { GraphHighlighter } from './graphs/GraphHighlighter';
import ReactCytoscape from './ReactCytoscape';

type CytoscapeLayoutProps = {
  namespace: string;
  layout: any;
  duration: string;
  onClick: (event: CytoscapeClickEvent) => void;
};

type CytoscapeLayoutState = {
  elements?: any;
  loading: boolean;
};

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

    console.log(`Starting ServiceGraphPage for namespace: ${this.props.namespace}`);

    this.state = {
      elements: [],
      loading: false
    };
    this.updateGraphElements = this.updateGraphElements.bind(this);
    this.handleTap = this.handleTap.bind(this);
    this.handleMouseIn = this.handleMouseIn.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
  }

  resizeWindow() {
    let canvasWrapper = document.getElementById('cytoscape-container')!;

    if (canvasWrapper != null) {
      let dimensions = canvasWrapper.getBoundingClientRect();
      canvasWrapper.style.height = `${document.documentElement.scrollHeight - dimensions.top}px`;
    }
  }

  componentDidMount() {
    window.addEventListener('resize', this.resizeWindow);
    this.resizeWindow();

    if (this.props.namespace.length !== 0) {
      this.updateGraphElements(this.props);
    }
  }

  componentWillReceiveProps(nextProps: CytoscapeLayoutProps) {
    if (nextProps.namespace !== this.props.namespace || nextProps.duration !== this.props.duration) {
      this.updateGraphElements(nextProps);
    }
  }

  shouldComponentUpdate(nextProps: any, nextState: any) {
    return this.state.loading !== nextState.loading;
  }

  cyRef(cy: any) {
    this.cy = cy;
    this.graphHighlighter = new GraphHighlighter(cy);

    const getCytoscapeBaseEvent = (event: any): CytoscapeBaseEvent | null => {
      const target = event.target;
      if (target === cy) {
        return { summaryType: 'graph', summaryTarget: cy };
      } else if (target.isNode()) {
        if (target.data('groupBy') === 'version') {
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
      if (cytoscapeEvent !== null) {
        this.handleTap(cytoscapeEvent);
      }
    });

    this.cy.on('mouseover', 'node,edge', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent !== null) {
        this.handleMouseIn(cytoscapeEvent);
      }
    });
    this.cy.on('mouseout', 'node,edge', (evt: any) => {
      const cytoscapeEvent = getCytoscapeBaseEvent(evt);
      if (cytoscapeEvent !== null) {
        this.handleMouseOut(cytoscapeEvent);
      }
    });
  }

  render() {
    return (
      <div id="cytoscape-container" style={{ marginRight: '25em' }}>
        <Spinner loading={this.state.loading}>
          <Button onClick={this.onRefreshButtonClick}>Refresh</Button>
          <ReactCytoscape
            containerID="cy"
            cyRef={cy => {
              this.cyRef(cy);
            }}
            elements={this.state.elements}
            style={GraphStyles.styles()}
            cytoscapeOptions={GraphStyles.options()}
            layout={this.props.layout}
          />
        </Spinner>
      </div>
    );
  }

  updateGraphElements(props: any) {
    const params = { duration: props.duration + 's' };
    this.setState({ loading: true });

    API.GetGraphElements(props.namespace, params)
      .then(response => {
        const responseData = response['data'];
        const elements = responseData && responseData.elements ? responseData.elements : { nodes: [], edges: [] };
        this.setState({ elements: elements, loading: false });
      })
      .catch(error => {
        this.setState({
          elements: [],
          loading: false
        });
        console.error(error);
      });
  }

  handleTap(event: CytoscapeClickEvent) {
    this.props.onClick(event);
    this.graphHighlighter.onClick(event);
  }

  handleMouseIn(event: CytoscapeMouseInEvent) {
    this.graphHighlighter.onMouseIn(event);
  }

  handleMouseOut(event: CytoscapeMouseOutEvent) {
    this.graphHighlighter.onMouseOut(event);
  }

  onRefreshButtonClick = event => {
    this.updateGraphElements(this.props);
  };
}
