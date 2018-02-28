import * as React from 'react';
import { ReactCytoscape } from 'react-cytoscape';
import { FakeData } from '../../pages/ServiceGraph/FakeData';
import { CytoscapeConfig } from './CytoscapeConfig';

type CytoscapeLayoutState = {
  elements?: any;
};

type CytoscapeLayoutProps = {
  // none yet
  namespace: any;
};

export default class CytoscapeLayout extends React.Component<CytoscapeLayoutProps, CytoscapeLayoutState> {
  cy: any;

  constructor(props: CytoscapeLayoutProps) {
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
    cy.on('tap', 'node', (evt: any) => {
      let node = evt.target;
      console.dir(node);
      console.log('clicked on: ' + node.id());
    });
  }

  render() {
    return (
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
    );
  }
}
