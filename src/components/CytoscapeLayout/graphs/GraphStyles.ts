export class GraphStyles {
  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false, autoungrabify: true };
  }

  static styles() {
    return [
      {
        selector: 'node',
        css: {
          content: (ele: any) => {
            return ele.data('text') || ele.data('id');
          },
          color: '#030303', // pf-black
          'background-color': '#f9d67a', // pf-gold-200
          'border-width': '1px',
          'border-color': '#030303', // pf-black
          'font-size': '10px',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-outline-color': '#f9d67a',
          'text-outline-width': '2px',
          'text-wrap': 'wrap',
          'overlay-padding': '6px',
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
          width: 2,
          'font-size': '9px',
          'text-margin-x': '10px',
          'text-rotation': 'autorotate',
          content: 'data(text)',
          'target-arrow-shape': 'vee',
          'line-color': 'data(color)',
          'target-arrow-color': '#030303', // pf-black
          'curve-style': 'bezier'
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
