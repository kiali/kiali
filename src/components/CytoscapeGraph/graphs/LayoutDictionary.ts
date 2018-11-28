import { ColaGraph } from './ColaGraph';
import { CoseGraph } from './CoseGraph';
import { DagreGraph } from './DagreGraph';
import { Layout } from '../../../types/GraphFilter';

const LayoutMap = {
  cola: ColaGraph.getLayout(),
  dagre: DagreGraph.getLayout(),
  'cose-bilkent': CoseGraph.getLayout()
};

const getLayout = (layout: Layout) =>
  LayoutMap.hasOwnProperty(layout.name) ? LayoutMap[layout.name] : LayoutMap.dagre;

const getLayoutByName = (layoutName: string) =>
  LayoutMap.hasOwnProperty(layoutName) ? LayoutMap[layoutName] : LayoutMap.dagre;

export { getLayout, getLayoutByName };
