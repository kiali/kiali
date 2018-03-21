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
  interval: string;
  onClick: (event: CytoscapeClickEvent) => void;
};

type CytoscapeLayoutState = {
  elements?: any;
  loading: boolean;
};

export type CytoscapeClickEvent = {
  summaryType: string;
  summaryTarget: any;
};

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
    if (nextProps.namespace !== this.props.namespace || nextProps.interval !== this.props.interval) {
      this.updateGraphElements(nextProps);
    }
  }

  shouldComponentUpdate(nextProps: any, nextState: any) {
    return this.state.loading !== nextState.loading;
  }

  cyRef(cy: any) {
    this.cy = cy;
    this.graphHighlighter = new GraphHighlighter(cy);

    cy.on('tap', (evt: any) => {
      const target = evt.target;
      if (target === cy) {
        console.log('TAP Background');
        this.handleTap({ summaryType: 'graph', summaryTarget: cy });
      } else if (target.isNode()) {
        if (target.data('groupBy') === 'version') {
          console.log('TAP Group');
          this.handleTap({ summaryType: 'group', summaryTarget: target });
        } else {
          console.log('TAP node');
          this.handleTap({ summaryType: 'node', summaryTarget: target });
        }
      } else if (target.isEdge()) {
        console.log('TAP edge');
        this.handleTap({ summaryType: 'edge', summaryTarget: target });
      } else {
        console.log('TAP UNHANDLED');
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
    const params = { interval: props.interval };
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

  onRefreshButtonClick = event => {
    this.updateGraphElements(this.props);
  };
}
