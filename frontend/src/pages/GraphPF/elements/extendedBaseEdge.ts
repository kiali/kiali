import { BaseEdge, Point } from '@patternfly/react-topology';

// This extends BaseEdge to eliminate Bendpoints when possible (mainly because Dagre layout
// does not provide an option to use or not use bendpoints). Bendpoints must be honored when
// we have multiple edges (i.e. different protocols) between the same two nodes.
// Kiali graphs tend to have a lot of nodes and boxes, and look cleaner with straight edges.

//TODO: Possibly make this optional
//export type ExtendedEdgeModel = EdgeModel & {
//  useBendpoints?: boolean;
//};

export class ExtendedBaseEdge extends BaseEdge {
  getBendpoints(): Point[] {
    if (this.hasParallelEdge()) {
      return super.getBendpoints();
    }
    return [];
  }

  setBendpoints(_points: Point[]): void {
    super.setBendpoints(this.hasParallelEdge() ? _points : []);
  }

  private hasParallelEdge(): boolean {
    const sourceEdges = this.getSource()
      .getSourceEdges()
      .filter(e => e.getTarget() === this.getTarget());

    if (sourceEdges.length < 2) {
      return false;
    }

    const targets = new Set(sourceEdges.map(e => e.getTarget().getId()));
    return targets.size < sourceEdges.length;
  }
}
