import { GraphLayout } from 'types/Graph';

// check if the graph layout supports grouping
export const supportsGroups = (layoutName: GraphLayout): boolean => {
  return layoutName === GraphLayout.Dagre;
};

export function getValidGraphLayout(layout: string): GraphLayout {
  switch (layout) {
    case GraphLayout.BreadthFirst:
      return GraphLayout.BreadthFirst;
    case GraphLayout.Concentric:
      return GraphLayout.Concentric;
    case GraphLayout.Grid:
      return GraphLayout.Grid;
    default:
      return GraphLayout.Dagre;
  }
}
