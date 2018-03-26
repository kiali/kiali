import { BreadthFirstGraph } from './BreadthFirstGraph';
import { ColaGraph } from './ColaGraph';
import { CoseGraph } from './CoseGraph';
import { DagreGraph } from './DagreGraph';
import { KlayGraph } from './KlayGraph';
import { Layout } from '../../../types/GraphFilter';

const LayoutMap = {
  breadthfirst: BreadthFirstGraph.getLayout(),
  cola: ColaGraph.getLayout(),
  dagre: DagreGraph.getLayout(),
  cose: CoseGraph.getLayout(),
  klay: KlayGraph.getLayout()
};

const getLayout = (layout: Layout) =>
  LayoutMap.hasOwnProperty(layout.name) ? LayoutMap[layout.name] : LayoutMap.dagre;

export { getLayout };
