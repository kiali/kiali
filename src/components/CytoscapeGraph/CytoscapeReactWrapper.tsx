import * as React from 'react';

import { GraphStyles } from './graphs/GraphStyles';

import canvas from 'cytoscape-canvas';
import cytoscape from 'cytoscape';
import cycola from 'cytoscape-cola';
import dagre from 'cytoscape-dagre';
import coseBilkent from 'cytoscape-cose-bilkent';
import GroupCompoundLayout from './Layout/GroupCompoundLayout';
import popper from 'cytoscape-popper';
import tippy from 'tippy.js';

cytoscape.use(canvas);
cytoscape.use(cycola);
cytoscape.use(dagre);
cytoscape.use(coseBilkent);
cytoscape.use(popper);
cytoscape('layout', 'group-compound-layout', GroupCompoundLayout);

type CytoscapeReactWrapperProps = any;

type CytoscapeReactWrapperState = {};

const styleContainer: React.CSSProperties = {
  height: '100%'
};

// Keep the browser right-click menu from popping up since have our own context menu
window.oncontextmenu = () => {
  // turn off browser right-click menus on Graph page only
  return !window.location.pathname.includes('graph');
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
  cy: any;
  divParentRef: any;

  // @todo: We need take care of this at global app level
  private static makeDetailsPageUrl(element: any) {
    const data = element.data();
    const namespace = data.namespace;
    const nodeType = data.nodeType;
    const workload = data.workload;
    let app = data.app;
    let urlNodeType = app;
    if (nodeType === 'app') {
      urlNodeType = 'applications';
    } else if (nodeType === 'service') {
      urlNodeType = 'services';
    } else if (workload) {
      urlNodeType = 'workloads';
      app = workload;
    }
    return `/namespaces/${namespace}/${urlNodeType}/${app}`;
  }

  constructor(props: CytoscapeReactWrapperProps) {
    super(props);
    this.cy = null;
    this.divParentRef = React.createRef();
  }

  // For other components to be able to manipulate the cy graph.
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
    return <div id="cy" className="graph" style={styleContainer} ref={this.divParentRef} />;
  }

  build() {
    if (this.cy) {
      this.destroy();
    }
    const opts = {
      container: this.divParentRef.current,
      boxSelectionEnabled: false,
      autounselectify: true,
      style: GraphStyles.styles(),
      ...GraphStyles.options()
    };

    this.cy = cytoscape(opts);

    // the context menus need a little bit of time for the DOM to settle down before they are added
    setTimeout(() => {
      this.buildContextMenus();
    }, 50);
  }

  destroy() {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
  }

  // Build right-click menus for the graph
  private buildContextMenus() {
    const makeTippyForNode: any = (node: any) => {
      return tippy(node.popperRef(), {
        content: (() => {
          // Remember we on Tippy.js which is html over the cytoscape canvas -- not React JSX
          // @todo: Refactor this to ReactDOM.render() to use JSX
          const tippyDiv = document.createElement('div');
          tippyDiv.setAttribute('class', 'kiali-graph-context-menu-container');
          const divTitle = document.createElement('div');
          divTitle.setAttribute('class', 'kiali-graph-context-menu-title');
          const nodeData = node.data();
          const version = nodeData.version ? `${nodeData.version}` : '';
          divTitle.innerHTML = `<strong>${nodeData.app}</strong>:${version}`;

          const detailsPageUrl = CytoscapeReactWrapper.makeDetailsPageUrl(node);
          const divDetailsItem = document.createElement('div');
          divDetailsItem.setAttribute('class', 'kiali-graph-context-menu-item');
          divDetailsItem.innerHTML = `<a class='kiali-graph-context-menu-item-link' href="${detailsPageUrl}" >Show Details</a>`;

          tippyDiv.append(divTitle);
          tippyDiv.append(divDetailsItem);

          return tippyDiv;
        })(),
        trigger: 'manual',
        arrow: true,
        placement: 'bottom',
        hideOnClick: true,
        multiple: false,
        sticky: false,
        interactive: true,
        theme: 'light-border',
        size: 'large'
      });
    };

    // add the 'tap' events to trigger tippy context menus for each node
    this.cy.nodes().each(appNode => {
      // ignore events if its is coming from a group node
      if (!appNode.data().isGroup) {
        appNode.on('cxttapstart taphold', (event: any) => {
          event.preventDefault();
          if (event.target) {
            const tipNode = makeTippyForNode(appNode).instances[0];
            // hide the tip after 6 seconds otherwise we can get a bunch of persistent tips
            setTimeout(() => {
              tipNode.hide();
            }, 6000);
            tipNode.show();
          }
        });
      }
    });

    /**
     * Uncomment for Edge Context Menus; currently we don't have any use for edge menus
     */
    // const makeTippyForEdge: any = (node: any) => {
    //   return tippy(node.popperRef(), {
    //     content: (() => {
    //       const tippyDiv = document.createElement('div');
    //       tippyDiv.align = 'left';
    //       const divTitle = document.createElement('div');
    //       divTitle.setAttribute('align', 'center');
    //       divTitle.innerHTML = `<strong>Edge Properties</strong>`;
    //       const divProtocol = document.createElement('div');
    //       const nodeData = node.data();
    //       divProtocol.innerHTML = `<strong>Protocol:</strong> ${nodeData.protocol}`;
    //       tippyDiv.append(divTitle);
    //       tippyDiv.append(divProtocol);
    //       return tippyDiv;
    //     })(),
    //     trigger: 'manual',
    //     arrow: true,
    //     followCursor: true,
    //     placement: 'bottom',
    //     distance: -45, // shouldn't have to do this but you do or else the tip is a couple cm below the edge
    //     hideOnClick: true,
    //     multiple: false,
    //     sticky: false,
    //     interactive: false,
    //     theme: 'light-border',
    //     size: 'large'
    //   });
    // };
    //
    // // add the 'tap' events to trigger tippy context menus for each edge
    // this.cy.edges().each(edgeNode => {
    //   edgeNode.on('cxttapstart taphold', (event: any) => {
    //     if (event.target) {
    //       const tipNode = makeTippyForEdge(edgeNode).instances[0];
    //       tipNode.show();
    //     }
    //   });
    // });
  }
}

export default CytoscapeReactWrapper;
