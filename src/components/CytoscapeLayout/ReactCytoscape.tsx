import React, { Component } from 'react';
import cytoscape from 'cytoscape';
import cycola from 'cytoscape-cola';
import dagre from 'cytoscape-dagre';
import coseBilkent from 'cytoscape-cose-bilkent';
import klay from 'cytoscape-klay';
import popper from 'cytoscape-popper';
import { PfColors } from '../../components/Pf/PfColors';

cytoscape.use(cycola);
cytoscape.use(dagre);
cytoscape.use(coseBilkent);
cytoscape.use(klay);
cytoscape.use(popper);

/**
 * A React Cytoscape wrapper.
 * props : style, elements, layout, cyRef, styleContainer, cytoscapeOptions, containerID
 */
class ReactCytoscape extends Component<any, any> {
  cy: any;
  container: any;

  getCyID() {
    return this.props.containerID || 'cy';
  }

  getContainer() {
    let c = this.container;
    return c;
  }

  defaultStyle() {
    return [
      {
        selector: 'node',
        css: {
          content: ele => {
            return ele.data('label') || ele.data('id');
          },
          'text-valign': 'center',
          'text-halign': 'center'
        }
      },
      {
        selector: '$node > node',
        css: {
          'padding-top': '10px',
          'padding-left': '10px',
          'padding-bottom': '10px',
          'padding-right': '10px',
          'text-valign': 'top',
          'text-halign': 'center',
          'background-color': PfColors.Black400
        }
      },
      {
        selector: 'edge',
        css: {
          'target-arrow-shape': 'vee'
        }
      },
      {
        selector: ':selected',
        css: {
          'background-color': PfColors.Black,
          'line-color': PfColors.Black,
          'target-arrow-color': PfColors.Black,
          'source-arrow-color': PfColors.Black
        }
      }
    ];
  }

  style() {
    return this.props.style || this.defaultStyle();
  }

  elements() {
    return this.props.elements || {};
  }

  layout() {
    return this.props.layout || { name: 'cola' };
  }

  cytoscapeOptions() {
    return this.props.cytoscapeOptions || {};
  }

  build() {
    let opts = Object.assign(
      {
        container: this.getContainer(),

        boxSelectionEnabled: false,
        autounselectify: true,

        style: this.style(),
        elements: this.elements(),
        layout: this.layout()
      },
      this.cytoscapeOptions()
    );

    this.cy = cytoscape(opts);

    if (this.props.cyRef) {
      this.props.cyRef(this.cy);
    }
    return this.cy;
  }

  componentWillUnmount() {
    this.clean();
  }

  componentDidMount() {
    this.build();
  }

  componentDidUpdate() {
    this.clean();
    this.build();
  }

  render() {
    let style = this.props.styleContainer || {};
    let styleContainer = Object.assign({ height: '100%', width: '100%', display: 'block' }, style);
    return (
      <div
        className="graph"
        id={this.getCyID()}
        ref={elt => {
          this.container = elt;
        }}
        style={styleContainer}
      />
    );
  }

  clean() {
    if (this.cy) {
      this.cy.destroy();
    }
  }
}

export default ReactCytoscape;
