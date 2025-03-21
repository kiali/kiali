import {
  Graph,
  Layout,
  GridLayout,
  ConcentricLayout,
  LayoutFactory,
  BreadthFirstLayout
} from '@patternfly/react-topology';
import { GraphLayout } from '../GraphPF';
import { ExtendedDagreLayout } from './ExtendedDagreLayout';

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
    case GraphLayout.BreadthFirst:
      return new BreadthFirstLayout(graph);
    case GraphLayout.Concentric:
      return new ConcentricLayout(graph);
    case GraphLayout.Grid:
      return new GridLayout(graph, {
        nodeDistance: 50
      });
    default:
      return new ExtendedDagreLayout(graph, {
        linkDistance: 40, // edgesep
        nodeDistance: 25, // nodesep
        ranksep: 15,
        ranker: 'network-simplex',
        rankdir: 'LR'
      });
  }
};
