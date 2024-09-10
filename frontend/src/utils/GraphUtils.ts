import { LayoutName } from 'pages/GraphPF/GraphPF';

// check if the graph layout supports grouping
export const supportsGroups = (layoutName: LayoutName): boolean => {
  return layoutName === LayoutName.Dagre;
};
