import { Graph, Layout, LayoutFactory } from '@patternfly/react-topology';
import { MeshLayout } from './MeshLayout';

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

export const layoutFactory: LayoutFactory = (type: string, graph: Graph): Layout | undefined => {
  switch (type) {
    default:
      // note - like other PFT layouts, this seems to work best
      // if you don't mess with the defaults.
      return new MeshLayout(graph, {});
  }
};
