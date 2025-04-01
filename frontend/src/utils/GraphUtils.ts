import { GraphLayout } from 'pages/Graph/Graph';

// check if the graph layout supports grouping
export const supportsGroups = (layoutName: GraphLayout): boolean => {
  return layoutName === GraphLayout.Dagre;
};
