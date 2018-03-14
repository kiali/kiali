import * as React from 'react';
import { ReactCytoscape } from 'react-cytoscape';
import { Spinner } from 'patternfly-react';
import PropTypes from 'prop-types';

import * as API from '../../services/Api';
import { GraphStyles } from './graphs/GraphStyles';
import { refreshSettings } from '../../model/RefreshSettings';

type CytoscapeLayoutState = {
  elements?: any;
  isLoading: boolean;
};

type CytoscapeLayoutProps = {
  namespace: string;
  layout: any;
  interval: string;
};

export default class CytoscapeLayout extends React.Component<CytoscapeLayoutProps, CytoscapeLayoutState> {
  static contextTypes = {
    router: PropTypes.object
  };

  cy: any;
  timerID: any;

  constructor(props: CytoscapeLayoutProps) {
    super(props);

    console.log('Starting ServiceGraphPage for namespace ' + this.props.namespace);

    this.state = {
      elements: [],
      isLoading: false
    };
    this.updateGraphElements = this.updateGraphElements.bind(this);
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
      this.timerID = setInterval(() => this.updateGraphElements(this.props), refreshSettings.interval);
    }
  }

  componentWillReceiveProps(nextProps: CytoscapeLayoutProps) {
    if (nextProps.namespace !== this.props.namespace || nextProps.interval !== this.props.interval) {
      this.updateGraphElements(nextProps);
    }
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  cyRef(cy: any) {
    this.cy = cy;
    cy.on('tap', 'node', (evt: any) => {
      const target = evt.target;
      const targetNode = cy.$id(target.id());
      const svc = targetNode.data('service');
      const service = svc.split('.')[0];
      if (service !== 'unknown') {
        this.context.router.history.push('/namespaces/' + this.props.namespace + '/services/' + service);
      }
    });

    // When you mouse over a service node, that node and the nodes it connects (including the edges)
    // remain the same, but all other nodes and edges will get dimmed, thus highlighting
    // the moused over node and its "neighborhood".
    //
    // When you mouse over an edge (i.e. a connector betwen nodes), that edge and
    // the nodes it connects will remain the same, but all others will get dimmed,
    // thus highlighting the moused over edge and its nodes.
    //
    // Note that we never dim the service group box elements (nor do we even process their mouse
    // events). We know an element is a group box if its isParent() returns true.
    cy.on('mouseover', 'node,edge', (evt: any) => {
      const target = evt.target;
      if (target.isParent()) {
        return;
      }
      let elesToDim;
      if (target.isNode()) {
        elesToDim = cy.elements().difference(target.closedNeighborhood());
      } else {
        // is edge
        elesToDim = cy
          .elements()
          .difference(target.connectedNodes())
          .difference(target);
      }
      elesToDim
        .filter(function(ele: any) {
          return !ele.isParent();
        })
        .addClass('mousedim');
    });

    cy.on('mouseout', 'node,edge', (evt: any) => {
      const target = evt.target;
      if (target.isParent()) {
        return;
      }
      let elesToRestore;
      if (target.isNode()) {
        elesToRestore = cy.elements().difference(target.closedNeighborhood());
      } else {
        // is edge
        elesToRestore = cy
          .elements()
          .difference(target.connectedNodes())
          .difference(target);
      }
      elesToRestore.removeClass('mousedim');
    });
  }

  render() {
    return (
      <div id="cytoscape-container" style={{ marginRight: '25em' }}>
        <Spinner loading={this.state.isLoading}>
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
    let params = { interval: props.interval };
    this.setState({ isLoading: true });
    API.GetGraphElements(props.namespace, params)
      .then(response => {
        const elements =
          response['data'] && response['data'].elements ? response['data'].elements : { nodes: [], edges: [] };
        this.setState({ elements: elements, isLoading: false });
      })
      .catch(error => {
        this.setState({
          elements: [],
          isLoading: false
        });
        console.error(error);
      });
  }
}
