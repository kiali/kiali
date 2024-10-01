import { BaseEdge, Edge, Point } from '@patternfly/react-topology';

// This extends BaseEdge to eliminate Bendpoints when possible (mainly because Dagre layout
// does not provide an option to use or not use bendpoints). Bendpoints must be honored when
// we have multiple edges (i.e. different protocols) between the same two nodes.
// Kiali graphs tend to have a lot of nodes and boxes, and look cleaner with straight edges.

//TODO: Possibly make this optional
//export type ExtendedEdgeModel = EdgeModel & {
//  useBendpoints?: boolean;
//};

export class ExtendedBaseEdge extends BaseEdge {
  // setBendpoint override ensures no bendpoints (straight edges) except when there are
  // multiple (i.e. parallel) edges between the same source and dest (i.e. traffic for
  // different protocols).
  setBendpoints(points: Point[]): void {
    if (points.length === 0) {
      return super.setBendpoints([]);
    }

    const parallelEdges = this.getParallelEdges();
    if (parallelEdges.length === 0) {
      return super.setBendpoints([]);
    }

    (this as ExtendedBaseEdge).setParallelBendpoints(parallelEdges);
  }

  // setParallelBendpoints applies our custom "skinny diamond" bendpoint strategy. For two edges
  // set a single bendpoint for each, mirrored over the imaginary straight edge. If there is a
  // third edge (very unlikely, but covers tcp, http and grpc), use a straight edge for the 3rd.
  setParallelBendpoints(parallelEdges: Edge[]): void {
    const sortedSourceEdges = parallelEdges.sort((a, b) => a.getId().localeCompare(b.getId()));
    sortedSourceEdges.forEach((e, i) =>
      (e as ExtendedBaseEdge).setBendpointsDirect(ExtendedBaseEdge.getCustomBendpoints(e, i))
    );
  }

  setBendpointsDirect(points: Point[]): void {
    super.setBendpoints(points);
  }

  private static getCustomBendpoints(e: Edge, edgeNum: number): Point[] {
    let bendpoint: Point | undefined;
    const x1 = e.getStartPoint().x;
    const y1 = e.getStartPoint().y;
    const x2 = e.getEndPoint().x;
    const y2 = e.getEndPoint().y;
    const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const xMid = (x1 + x2) / 2;
    const yMid = (y1 + y2) / 2;
    const h = 20; // arbitrary height that tries to be not too skinny or too wide
    switch (edgeNum) {
      case 0: {
        // slightly to one side of center
        const x = xMid + ((y2 - y1) / len) * h;
        const y = yMid + ((x1 - x2) / len) * h;
        bendpoint = new Point(x, y);
        break;
      }
      case 1: {
        // slightly to other side of center
        const x = xMid - ((y2 - y1) / len) * h;
        const y = yMid - ((x1 - x2) / len) * h;
        bendpoint = new Point(x, y);
        break;
      }
      default:
      // in the case of a 3rd protocal, use a straight edge
    }

    return bendpoint ? [bendpoint] : [];
  }

  private getParallelEdges(): Edge[] {
    // find source edges with the same destination
    const sourceEdges = this.getSource()
      .getSourceEdges()
      .filter(e => e.getTarget().getId() === this.getTarget().getId());

    if (sourceEdges.length < 2) {
      return [];
    }

    return sourceEdges;
  }
}
