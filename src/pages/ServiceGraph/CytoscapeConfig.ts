export class CytoscapeConfig {
  static getStyles() {
    return [
      {
        selector: 'node',
        css: {
          content: function(ele: any) {
            return ele.data('text') || ele.data('id');
          },
          color: 'white',
          'background-color': '#bbb',
          'text-outline-width': 1,
          'text-outline-color': '#999',
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
          color: '#070dff',
          'text-valign': 'top',
          'text-halign': 'center',
          'background-color': '#f5f1d8'
        }
      },
      {
        selector: 'edge',
        css: {
          width: 2,
          content: 'data(text)',
          'target-arrow-shape': 'triangle',
          'line-color': 'data(color)',
          'target-arrow-color': 'black'
        }
      },
      {
        selector: ':selected',
        css: {
          'background-color': 'yellow',
          'line-color': 'yellow',
          'target-arrow-color': 'yellow',
          'source-arrow-color': 'yellow'
        }
      }
    ];
  }
}
