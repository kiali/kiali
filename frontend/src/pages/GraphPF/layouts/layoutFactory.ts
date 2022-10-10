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
  console.log("IN IT");
  switch (type) {
    case 'Cola':
      return new ColaLayout(graph);
    case 'ColaNoForce':
      console.log("FOUND IT");
      return new ColaLayout(graph, { layoutOnDrag: false });
    case 'Concentric':
      return new ConcentricLayout(graph);
    case 'Dagre':
      return new DagreLayout(graph);
    case 'Force':
      return new ForceLayout(graph);
    case 'Grid':
      return new GridLayout(graph);
    default:
      return new ColaLayout(graph, { layoutOnDrag: false });
  }
};

export default layoutFactory;
