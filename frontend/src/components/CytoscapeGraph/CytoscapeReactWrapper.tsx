import * as React from 'react';
import * as Cy from 'cytoscape';

import { GraphStyles } from './graphs/GraphStyles';
import canvas from 'cytoscape-canvas';
import cytoscape from 'cytoscape';
import { BoxLayout } from './Layout/BoxLayout';
import popper from 'cytoscape-popper';
import { KialiGridLayout } from './Layout/KialiGridLayout';
import { KialiDagreLayout } from './Layout/KialiDagreLayout';
import { KialiConcentricLayout } from './Layout/KialiConcentricLayout';
import { KialiBreadFirstLayout } from './Layout/KialiBreadthFirstLayout';
import { setPFColorVals } from 'components/Pf/PfColors';
const nodeHtmlLabel = require('cy-node-html-label');

cytoscape.use(canvas);
cytoscape.use(popper);
cytoscape('layout', 'box-layout', BoxLayout);
cytoscape('layout', 'kiali-breadthfirst', KialiBreadFirstLayout);
cytoscape('layout', 'kiali-dagre', KialiDagreLayout);
cytoscape('layout', 'kiali-grid', KialiGridLayout);
cytoscape('layout', 'kiali-concentric', KialiConcentricLayout);

nodeHtmlLabel(cytoscape);

type CytoscapeReactWrapperProps = {};

type CytoscapeReactWrapperState = {};

const styleContainer: React.CSSProperties = {
  height: '100%'
};

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
 *
 * NOTE: The context menu stuff is defined in the CytoscapeReactWrapper because that is
 * where the cytoscape plugins are defined. And the context menu functions are defined in
 * here because they are not normal Cytoscape defined functions like those found in CytoscapeGraph.
 */
export class CytoscapeReactWrapper extends React.Component<CytoscapeReactWrapperProps, CytoscapeReactWrapperState> {
  cy?: Cy.Core;
  divParentRef: React.RefObject<HTMLDivElement>;

  constructor(props: CytoscapeReactWrapperProps) {
    super(props);
    this.divParentRef = React.createRef();
  }

  // For other components to be able to manipulate the cy graph.
  getCy() {
    return this.cy;
  }

  // This is VERY important - this must always return false to ensure the div is never destroyed.
  // If the div is destroyed, the cached cy becomes useless.
  shouldComponentUpdate(_nextProps: CytoscapeReactWrapperProps, _nextState: CytoscapeReactWrapperState) {
    return false;
  }

  componentDidMount() {
    this.build();
  }

  componentWillUnmount() {
    this.destroy();
  }

  render() {
    return <div id="cy" className="graph" style={styleContainer} ref={this.divParentRef} />;
  }

  private build() {
    if (this.cy) {
      this.destroy();
    }

    // ensure required colors are set
    setPFColorVals(this.divParentRef.current!);

    const opts = {
      container: this.divParentRef.current,
      boxSelectionEnabled: false,
      style: GraphStyles.styles(),
      ...GraphStyles.options()
    };

    this.cy = cytoscape(opts);
    // Using an extension
    (this.cy as any).nodeHtmlLabel(GraphStyles.htmlNodeLabels(this.cy));
  }

  private destroy() {
    if (this.cy) {
      this.cy.destroy();
      this.cy = undefined;
    }
  }
}
