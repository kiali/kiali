import {
  Graph,
  Layout,
  DagreLayout,
  GridLayout,
  ConcentricLayout,
  LayoutFactory,
  BreadthFirstLayout
} from '@patternfly/react-topology';
import { LayoutName } from '../GraphPF';

export const layoutFactory: LayoutFactory = (type: string, graph: Graph): Layout | undefined => {
  switch (type) {
    case LayoutName.BreadthFirst:
      return new BreadthFirstLayout(graph);
    case LayoutName.Concentric:
      return new ConcentricLayout(graph);
    case LayoutName.Grid:
      return new GridLayout(graph);
    default:
      return new DagreLayout(graph, {
        //allowDrag: true,
        //layoutOnDrag: true,
        marginx: undefined,
        marginy: undefined,
        //nodesep: undefined,
        //edgesep: undefined,
        ranker: 'network-simplex',
        rankdir: 'LR'
      });
  }
};
