export class KialiDagreGraph {
  static getLayout() {
    return {
      name: 'kiali-dagre',
      fit: false,
      nodeDimensionsIncludeLabels: true,
      rankDir: 'LR'
    };
  }
}
