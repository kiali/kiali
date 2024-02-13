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
    /*
    case LayoutName.Dagre:
      return new DagreLayout(graph, {
        linkDistance: 40,
        nodeDistance: 25,
        marginx: undefined,
        marginy: undefined,
        ranker: 'network-simplex',
        rankdir: 'LR'
      });
    case LayoutName.Cola:
      return new ColaGroupsLayout(graph, {
        // layoutOnDrag: false,
        maxTicks: 0,
        nodeDistance: 35
      });
    */
    default:
      return new MeshLayout(graph, {
        // layoutOnDrag: false,
        maxTicks: 0,
        nodeDistance: 35
      });
  }
};
