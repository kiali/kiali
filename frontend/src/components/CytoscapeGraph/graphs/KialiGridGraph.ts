export class KialiGridGraph {
  static getLayout() {
    return {
      name: 'kiali-grid',
      animate: false,
      fit: false,
      nodeDimensionsIncludeLabels: true,
      padding: 0,
      condense: false // Condense false works well with NO BoxLayout, but not optimized for namespaces layout
    };
  }
}
