export class GraphStyles {
  static options() {
    return { wheelSensitivity: 0.1, autounselectify: false };
  }

  static styles() {
    return [
      {
        selector: 'node',
        css: {
          content: (ele: any) => {
            return ele.data('text') || ele.data('id');
          },
          color: 'black',
          'background-color': '#bbb',
          'border-width': '1px',
          'border-color': '#000',
          'font-size': '10px',
          'text-valign': 'center',
          'text-halign': 'right'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': '3px',
          'border-color': '#116CD6',
          'border-opacity': '0.7',
          'background-color': '#77828C',
          'text-outline-color': '#77828C'
        }
      },
      {
        selector: '$node > node',
        css: {
          'padding-top': '10px',
          'padding-left': '20px',
          'padding-bottom': '10px',
          'padding-right': '20px',
          'text-outline-width': 1,
          'text-outline-color': '#cfcfcf',
          color: '#8d7f6c',
          'text-valign': 'top',
          'text-halign': 'center',
          'background-color': '#f5f1d8'
        }
      },
      {
        selector: 'edge',
        css: {
          width: 3,
          color: '#434343',
          'font-size': '8px',
          content: 'data(text)',
          'target-arrow-shape': 'vee',
          'line-color': 'data(color)',
          'target-arrow-color': 'black',
          'curve-style': 'bezier'
        }
      },
      {
        selector: ':selected',
        css: {
          'background-color': '#116CD6',
          'line-color': '#84B5EA',
          'target-arrow-color': '#84B5EA',
          'source-arrow-color': '#84B5EA'
        }
      },
      // TODO: is this needed anywhere?
      {
        selector: 'edge.highlighted',
        style: {
          'line-color': '#116CD6',
          opacity: '0.95',
          width: '25px'
        }
      },
      // When you mouse over a node, all nodes other than the moused over node
      // and its direct incoming/outgoing edges/nodes are dimmed by these styles.
      {
        selector: 'node.mousedim',
        style: {
          opacity: '0.4'
        }
      },
      {
        selector: 'edge.mousedim',
        style: {
          opacity: '0.4'
        }
      }
    ];
  }
}
