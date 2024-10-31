import { DragEvent, DagreLayout, DragOperationWithType, Layout, Node } from '@patternfly/react-topology';
import { descendents } from 'helpers/GraphHelpers';

export class ExtendedDagreLayout extends DagreLayout implements Layout {
  // endDrag override allows us to get around what I consider a PFT bug, and update any
  // bendpoints after the drag operation.
  protected endDrag(element: Node, event: DragEvent, operation: DragOperationWithType): void {
    super.endDrag(element, event, operation);

    if (element.isGroup()) {
      this.endGroupDrag(element);
    } else {
      this.endNodeDrag(element, true);
    }
  }

  private endGroupDrag(group: Node): void {
    // to avoid processing both ends of every edge, just do the source edges
    descendents(group).forEach(n => this.endNodeDrag(n, false));
  }

  private endNodeDrag(node: Node, includeTargetEdges: boolean): void {
    // update bendpoints as needed
    node.getSourceEdges().forEach(e => e.setBendpoints(e.getBendpoints()));
    if (includeTargetEdges) {
      node.getTargetEdges().forEach(e => e.setBendpoints(e.getBendpoints()));
    }
  }
}
