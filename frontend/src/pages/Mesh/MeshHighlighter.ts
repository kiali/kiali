// There are three special states for a Node or Edge:
//
//   - selected: The node has been single-clicked and is 'selected' in cytoscape
//   - hovered: The mouse is currently over the element.  It is marked with HoveredClass
//   - highlighted: The element is to be emphasized (see below).  It is marked with HighlightClass.
//   - unhighlighted: The element is to be de-emphasized (see below).  It is marked with UnhighlightClass.
//
// When a node or edge is hovered or selected:
//   - highlight the end-to-end paths (nodes and edges) for which the element may participate.
//     - note, this is not trace-based, so a highlighted path may not represent an actual request path
//   - unhighlight the remaining elements
//   - hovering is ignored while an element is selected
//
// When a box is selected:
//   - highlight the contained nodes and their related nodes (including edges).
//
// When a boxed node is highlighted it's parent boxes, if any, are highlighted as well.
//
// Note that this code is responsible only for maintaining the element class assignments, the actual
// visualization changes, given the class assignments, is up to GraphStyles.ts.
//

import { Edge, Node } from '@patternfly/react-topology';
import { Controller, GraphElement } from '@patternfly/react-topology/dist/esm/types';
import { NodeData, ancestors, predecessors, successors } from './MeshElems';

export class MeshHighlighter {
  controller: Controller;
  hovered?: GraphElement;
  selectedId?: string;

  constructor(controller: Controller) {
    this.controller = controller;
  }

  setSelectedId(selectedId?: string) {
    // ignore clicks on the currently selected element
    if (this.selectedId === selectedId) {
      return;
    }

    this.selectedId = selectedId;
    this.clearHover();
    this.clearHighlighting();
  }

  clearHover = () => {
    if (this.hovered) {
      this.hovered = undefined;
    }
  };

  onMouseIn = (element: GraphElement) => {
    // only set Hovered when nothing is currently selected, otherwise just leave the selected element as-is
    if (!this.selectedId) {
      this.hovered = element;
      this.refresh();
    }
  };

  onMouseOut = (element: GraphElement) => {
    if (this.hovered === element) {
      this.clearHover();
      this.clearHighlighting();
    }
  };

  clearHighlighting = () => {
    this.controller.getElements().forEach(e => {
      const data = e.getData() as NodeData;
      if (data.isHighlighted || data.isUnhighlighted) {
        e.setData({ ...data, isHighlighted: false, isUnhighlighted: false });
      }
    });
  };

  refresh = () => {
    const highlighted = this.getHighlighted();
    if (!highlighted.toHighlight) {
      return;
    }

    highlighted.toHighlight.forEach(e => {
      e.setData({ ...e.getData(), isHighlighted: true });
    });

    if (highlighted.unhighlightOthers) {
      this.controller.getElements().forEach(e => {
        const data = e.getData() as NodeData;
        if (!data.isHighlighted) {
          e.setData({ ...data, isUnhighlighted: true });
        }
      });
    }
  };

  // Returns the nodes to highlight. Highlighting for a hovered or selected element
  // is the same, it extends to full inbound and outbound paths.
  getHighlighted(): { toHighlight: GraphElement[]; unhighlightOthers: boolean } {
    const isHover = !this.selectedId;
    const element = isHover ? this.hovered : this.controller.getElementById(this.selectedId!);
    if (element) {
      switch (element.getKind()) {
        case 'node':
          if ((element as Node).isGroup()) {
            return this.getBoxHighlight(element as Node);
          }
          return { toHighlight: this.getNodeHighlight(element as Node), unhighlightOthers: true };
        case 'edge':
          return { toHighlight: this.getEdgeHighlight(element as Edge), unhighlightOthers: true };

        default:
        // fall through
      }
    }
    return { toHighlight: [], unhighlightOthers: false };
  }

  includeAncestorNodes(nodes: GraphElement[]) {
    return nodes.reduce((all: GraphElement[], current) => {
      all.push(current);
      if (current.getKind() === 'node' && (current as Node).hasParent()) {
        all = Array.from(
          new Set<GraphElement>([...all, ...ancestors(current as Node)])
        );
      }
      return all;
    }, []);
  }

  getNodeHighlight(node: Node) {
    const elems = predecessors(node).concat(successors(node));
    elems.push(node);
    return this.includeAncestorNodes(elems);
  }

  getEdgeHighlight(edge: Edge) {
    const source = edge.getSource();
    const target = edge.getTarget();
    let elems = [edge, source, target, ...predecessors(source), ...successors(target)];
    elems = this.includeAncestorNodes(elems);
    return elems;
  }

  getBoxHighlight(box: Node): { toHighlight: GraphElement[]; unhighlightOthers: boolean } {
    // Namespace and Cluster boxes highlight themselves and their anscestors.
    return { toHighlight: this.includeAncestorNodes([box]), unhighlightOthers: false };
  }
}
