import {
  Graph,
  Layout,
  ForceLayout,
  ColaLayout,
  DagreLayout,
  GridLayout,
  ConcentricLayout,
  LayoutFactory
} from '@patternfly/react-topology';

const layoutFactory: LayoutFactory = (type: string, graph: Graph): Layout | undefined => {
  switch (type) {
    case 'Cola':
      return new ColaLayout(graph);
    case 'ColaNoForce':
      return new ColaLayout(graph, { layoutOnDrag: false, maxTicks: 1 }); // maxTicks=1 removes animation
    case 'Concentric':
      return new ConcentricLayout(graph);
    case 'Dagre':
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

    case 'Force':
      return new ForceLayout(graph);
    case 'Grid':
      return new GridLayout(graph);
    default:
      return new ColaLayout(graph, { layoutOnDrag: false });
  }
};

export default layoutFactory;
