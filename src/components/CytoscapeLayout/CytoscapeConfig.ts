export class CytoscapeConfig {
  static getStyles() {
    return [
      {
        selector: 'node',
        css: {
          content: (ele: any) => {
            return ele.data('text') || ele.data('id');
          },
          color: 'black',
          'background-color': '#bbb',
          'text-valign': 'center',
          'text-halign': 'right'
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
          color: '#666',
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
      }
    ];
  }
}
