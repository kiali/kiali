import * as React from 'react';
import { ReactCytoscape } from 'react-cytoscape';
import * as API from '../../services/Api';
import PropTypes from 'prop-types';
import { GraphStyles } from './graphs/GraphStyles';

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

  constructor(props: CytoscapeLayoutProps) {
    super(props);

    console.log('Starting ServiceGraphPage for namespace ' + this.props.namespace);

    this.state = {
      elements: []
    };
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
    }
  }

  componentWillReceiveProps(nextProps: CytoscapeLayoutProps) {
    if (nextProps.namespace !== this.props.namespace) {
      this.updateGraphElements(nextProps.namespace);
    }
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

  private updateGraphElements(newNamespace: string) {
    API.GetGraphElements(newNamespace, null)
      .then(response => {
        const elements: { [key: string]: any } = response['data'];
        console.log(elements);
        this.setState(elements);
      })
      .catch(error => {
        this.setState({});
        console.error(error);
      });
  }
}
