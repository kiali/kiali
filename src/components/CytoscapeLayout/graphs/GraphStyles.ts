export class GraphStyles {
  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static styles() {
    return [
      {
        selector: 'node',
        css: {
          color: '#030303', // pf-black
          content: (ele: any) => {
            const version = ele.data('version');
            if (ele.data('parent')) {
              return version;
            }
            const name = ele.data('service') || ele.data('id');
            const service = name.split('.')[0];
            return version && version !== 'unknown' ? service + '\n' + version : service;
          },
          'background-color': '#f9d67a', // pf-gold-200
          'border-color': '#030303', // pf-black
          'border-style': (ele: any) => {
            return ele.data('flagUnused') ? 'dotted' : 'solid';
          },
          'border-width': '1px',
          'font-size': '10px',
          'overlay-padding': '6px',
          'text-halign': 'center',
          'text-outline-color': '#f9d67a',
          'text-outline-width': '2px',
          'text-valign': 'center',
          'text-wrap': 'wrap',
          'z-index': '10'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': '3px',
          'border-color': '#0088ce' // pf-blue
        }
      },
      {
        // version group boxes
        selector: '$node > node',
        css: {
          'text-valign': 'top',
          'text-halign': 'right',
          'text-margin-x': '2px',
          'text-margin-y': '8px',
          'text-rotation': '90deg',
          'background-color': '#fbeabc' // pf-gold-100
        }
      },
      {
        selector: 'edge',
        css: {
          content: (ele: any) => {
            const rate = ele.data('rate') ? parseFloat(ele.data('rate')) : 0;
            const pErr = ele.data('percentErr') ? parseFloat(ele.data('percentErr')) : 0;
            if (rate > 0) {
              return pErr > 0 ? rate.toFixed(2) + ', ' + pErr.toFixed(1) + '%' : rate.toFixed(2);
            }
            return '';
          },
          'curve-style': 'bezier',
          'font-size': '7px',
          'line-color': (ele: any) => {
            const rate = ele.data('rate') ? parseFloat(ele.data('rate')) : 0;
            if (rate === 0 || ele.data('flagUnused')) {
              return 'black';
            }
            const pErr = ele.data('percentErr') ? parseFloat(ele.data('percentErr')) : 0;
            // todo: these thresholds should come from somewhere global
            if (pErr > 2.0) {
              return 'red';
            }
            if (pErr > 0.1) {
              return 'orange';
            }
            return 'green';
          },
          'line-style': (ele: any) => {
            return ele.data('flagUnused') ? 'dotted' : 'solid';
          },
          'target-arrow-shape': 'vee',
          'text-margin-x': '6px',
          'text-rotation': 'autorotate',
          'target-arrow-color': '#030303', // pf-black
          width: 2
        }
      },
      {
        selector: 'edge:selected',
        css: {
          'line-color': '#0088ce', // pf-blue
          'target-arrow-color': '#0088ce', // pf-blue
          'source-arrow-color': '#0088ce' // pf-blue
        }
      },
      // When you mouse over a node, all nodes other than the moused over node
      // and its direct incoming/outgoing edges/nodes are dimmed by these styles.
      {
        selector: 'node.mousedim',
        style: {
          opacity: '0.3'
        }
      },
      {
        selector: 'edge.mousedim',
        style: {
          opacity: '0.3'
        }
      }
    ];
  }
}
