import { GraphLayout } from 'pages/Graph/GraphPF';

// check if the graph layout supports grouping
export const supportsGroups = (layoutName: GraphLayout): boolean => {
  return layoutName === GraphLayout.Dagre;
};
