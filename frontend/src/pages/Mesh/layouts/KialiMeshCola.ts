// Used only for Mesh page (PFT graphs only care about the name)
// TODO: Fix up the graph definition handling when Cytoscape is retired
export class KialiMeshCola {
  static getLayout() {
    return {
      name: 'kiali-mesh-cola'
    };
  }
}
