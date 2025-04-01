import { DagreLayout, Graph, Layout, LayoutFactory } from '@patternfly/react-topology';
import { MeshDagreLayout } from './MeshDagreLayout';
//import { MeshColaLayout } from './MeshColaLayout';

/*
This is just for reference, a copy of PFT defaults, so we can compare any tweaks we've made below...

export const LAYOUT_DEFAULTS: LayoutOptions = {
  linkDistance: 60,
  nodeDistance: 35,
  groupDistance: 35,
  collideDistance: 0,
  simulationSpeed: 10,
  chargeStrength: 0,
  allowDrag: true,
  layoutOnDrag: true
};
*/

export enum MeshLayoutType {
  Layout = 'layout',
  LayoutNoFit = 'layoutNoFit',
  Resize = 'resize'
}

// the layouts offered by the mesh page
export enum MeshLayout {
  Dagre = 'dagre',
  //MeshCola = 'kiali-mesh-cola',
  MeshDagre = 'kiali-mesh-dagre'
}

export function getValidMeshLayout(layout: string): MeshLayout {
  switch (layout) {
    case MeshLayout.MeshDagre:
      return MeshLayout.MeshDagre;
    default:
      return MeshLayout.Dagre;
  }
}

export const layoutFactory: LayoutFactory = (type: string, graph: Graph): Layout | undefined => {
  switch (type) {
    //case LayoutName.MeshCola:
    //  return new MeshColaLayout(graph, {
    //    layoutOnDrag: false
    //  });
    case MeshLayout.MeshDagre:
      return new MeshDagreLayout(graph, {
        layoutOnDrag: false,
        ranksep: 15
      });
    default:
      // note - like other PFT layouts, this seems to work best
      // if you don't mess much with the defaults.
      return new DagreLayout(graph, {
        layoutOnDrag: false,
        ranksep: 15
      });
  }
};
