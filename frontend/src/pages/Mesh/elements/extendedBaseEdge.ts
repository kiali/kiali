import { BaseEdge, Point } from '@patternfly/react-topology';

// This extends BaseEdge to eliminate Bendpoints (mainly because Dagre layout does not provide an option to use or not use bendpoints).
// Kiali graphs tend to have a lot of nodes and boxes, and look cleaner with straight edges.

//TODO: Possibly make this optional
//export type ExtendedEdgeModel = EdgeModel & {
//  useBendpoints?: boolean;
//};

export class ExtendedBaseEdge extends BaseEdge {
  getBendpoints(): Point[] {
    return [];
  }

  setBendpoints(_points: Point[]): void {
    super.setBendpoints([]);
  }
}
