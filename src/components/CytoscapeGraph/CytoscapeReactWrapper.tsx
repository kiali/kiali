import * as React from 'react';

import { GraphStyles } from './graphs/GraphStyles';
import * as LayoutDictionary from './graphs/LayoutDictionary';

import canvas from 'cytoscape-canvas';
import cytoscape from 'cytoscape';
import cycola from 'cytoscape-cola';
import dagre from 'cytoscape-dagre';
import coseBilkent from 'cytoscape-cose-bilkent';
import klay from 'cytoscape-klay';
import popper from 'cytoscape-popper';
import panzoom from 'cytoscape-panzoom';
import 'cytoscape-panzoom/cytoscape.js-panzoom.css';

cytoscape.use(canvas);
cytoscape.use(cycola);
cytoscape.use(dagre);
cytoscape.use(coseBilkent);
cytoscape.use(klay);
cytoscape.use(popper);
panzoom(cytoscape);

type CytoscapeReactWrapperProps = {
  elements: any;
  layout: any;
};

type CytoscapeReactWrapperState = {};

/**
 * The purpose of this wrapper is very simple and minimal - to provide a long-lived <div> element that can be used
 * as the parent container for the cy graph (cy.container). Because cy does not provide the ability to re-parent an
 * existing graph (e.g. there is no API such as "cy.setContainer(div)"), the only way to be able to re-use a
 * graph (without re-creating and re-rendering it all the time) is to have it inside a wrapper like this one
 * that does not update/re-render itself, thus keeping the original <div> intact.
 *
 * Other than creating and initializing the cy graph, this component should do nothing else. Parent components
 * should get a ref to this component can call getCy() in order to perform additional processing on the graph.
 * It is the job of the parent component to manipulate and update the cy graph during runtime.
 */
export class CytoscapeReactWrapper extends React.Component<CytoscapeReactWrapperProps, CytoscapeReactWrapperState> {
  cy: any;
  panzoom: any;
  divParentRef: any;

  constructor(props: CytoscapeReactWrapperProps) {
    super(props);
    this.cy = null;
    this.divParentRef = React.createRef();
  }

  // For other components to be able to maniuplate the cy graph.
  getCy() {
    return this.cy;
  }

  // This is VERY important - this must always return false to ensure the div is never destroyed.
  // If the div is destroyed, the cached cy becomes useless.
  shouldComponentUpdate(nextProps: any, nextState: any) {
    return false;
  }

  componentDidMount() {
    this.build();
  }

  componentWillUnmount() {
    this.destroy();
  }

  render() {
    const styleContainer = {
      height: '100%'
    };
    return <div id="cy" className="graph" style={styleContainer} ref={this.divParentRef} />;
  }

  build() {
    if (this.cy) {
      this.destroy();
    }
    let opts = Object.assign(
      {
        container: this.divParentRef.current,
        boxSelectionEnabled: false,
        autounselectify: true,
        style: GraphStyles.styles(),
        elements: this.props.elements,
        layout: LayoutDictionary.getLayout(this.props.layout)
      },
      GraphStyles.options()
    );

    this.cy = cytoscape(opts);
    this.panzoom = this.cy.panzoom();
  }

  destroy() {
    if (this.cy) {
      this.panzoom.destroy();
      this.panzoom = null;

      this.cy.destroy();
      this.cy = null;
    }
  }
}

export default CytoscapeReactWrapper;
