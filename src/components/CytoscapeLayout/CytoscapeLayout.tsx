import * as React from 'react';
import { ReactCytoscape } from 'react-cytoscape';
import PropTypes from 'prop-types';

import * as API from '../../services/Api';
import { GraphStyles } from './graphs/GraphStyles';
import { refreshSettings } from '../../model/RefreshSettings';

type CytoscapeLayoutState = {
  elements?: any;
};

type CytoscapeLayoutProps = {
  namespace: string;
  layout: any;
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
      elements: {}
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
      this.updateGraphElements(this.props.namespace);
      this.timerID = setInterval(() => this.updateGraphElements(this.props.namespace), refreshSettings.interval);
    }
  }

  componentWillReceiveProps(nextProps: CytoscapeLayoutProps) {
    if (nextProps.namespace !== this.props.namespace) {
      this.updateGraphElements(nextProps.namespace);
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
    // Note that we never dim the service group box elements (nor do we even process their mouse
    // events). We know an element is a group box if its isParent() returns true.
    cy.on('mouseover', 'node', (evt: any) => {
      const target = evt.target;
      if (target.isParent()) {
        return;
      }
      cy
        .elements()
        .difference(target.closedNeighborhood())
        .filter(function(ele: any) {
          return !ele.isParent();
        })
        .addClass('mousedim');
    });
    cy.on('mouseout', 'node', (evt: any) => {
      const target = evt.target;
      if (target.isParent()) {
        return;
      }
      cy
        .elements()
        .difference(target.closedNeighborhood())
        .removeClass('mousedim');
    });
  }

  render() {
    return (
      <div id="cytoscape-container" style={{ marginRight: '25em' }}>
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
      </div>
    );
  }

  updateGraphElements(newNamespace: string) {
    API.GetGraphElements(newNamespace, null)
      .then(response => {
        const elements =
          response['data'] && response['data'].elements ? response['data'].elements : { nodes: [], edges: [] };
        console.log(`New graph data for ${newNamespace}`, elements);
        this.setState({ elements: elements });
      })
      .catch(error => {
        this.setState({});
        console.error(error);
      });
  }
}
