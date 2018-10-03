export class DagreGraph {
  static getLayout() {
    return {
      name: 'dagre',
      fit: false,
      nodeDimensionsIncludeLabels: true,
      rankDir: 'LR'
    };
  }
}
