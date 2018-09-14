export class DagreGraph {
  static getLayout() {
    return {
      name: 'dagre',
      rankDir: 'LR',
      nodeDimensionsIncludeLabels: true
    };
  }
}
