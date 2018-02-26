import * as React from 'react';
import { ReactCytoscape } from 'react-cytoscape';
import { FakeData } from './FakeData';
import { CytoscapeConfig } from './CytoscapeConfig';

type ServiceGraphState = {
  elements?: any;
};

type ServiceGraphProps = {
  // none yet
};

class ServiceGraphPage extends React.Component<ServiceGraphProps, ServiceGraphState> {
  cy: any;

  constructor(props: ServiceGraphProps) {
    super(props);

    console.log('Starting ServiceGraphPage');

    this.state = {
      elements: {}
    };
  }

  componentDidMount() {
    this.setState({ elements: FakeData.getElements() });
  }

  cyRef(cy: any) {
    this.cy = cy;
    cy.on('tap', 'node', function(evt: any) {
      let node = evt.target;
      console.dir(node);
      console.log('clicked on: ' + node.id());
    });
  }

  render() {
    return (
      <div className="container-fluid container-pf-nav-pf-vertical">
        <div className="page-header">
          <h2>Services Graph</h2>
        </div>
        <div style={{ height: 600 }}>
          <ReactCytoscape
            containerID="cy"
            cyRef={cy => {
              this.cyRef(cy);
            }}
            elements={this.state.elements}
            style={CytoscapeConfig.getStyles()}
            cytoscapeOptions={{ wheelSensitivity: 0.1, autounselectify: false }}
            layout={{ name: 'dagre' }}
          />
        </div>
      </div>
    );
  }
}

export default ServiceGraphPage;
