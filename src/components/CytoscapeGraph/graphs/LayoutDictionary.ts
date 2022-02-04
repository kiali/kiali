import { DagreGraph } from './DagreGraph';
import { Layout } from '../../../types/Graph';
import { GridGraph } from './GridGraph';
import { ConcentricGraph } from './ConcentricGraph';

const LayoutMap = {
  dagre: DagreGraph.getLayout(),
  grid: GridGraph.getLayout(),
  concentric: ConcentricGraph.getLayout()
};

const getLayout = (layout: Layout) =>
  LayoutMap.hasOwnProperty(layout.name) ? LayoutMap[layout.name] : LayoutMap.dagre;

const getLayoutByName = (layoutName: string) =>
  LayoutMap.hasOwnProperty(layoutName) ? LayoutMap[layoutName] : LayoutMap.dagre;

export { getLayout, getLayoutByName };
