import { BoxByType, CytoscapeBaseEvent } from '../../../types/Graph';
import { CyNode } from '../CytoscapeGraphUtils';
import { DimClass, HoveredClass, HighlightClass } from './GraphStyles';

// There are three special states for a Node or Edge:
//
//   - selected: The node has been single-clicked and is 'selected' in cytoscape
//   - hovered: The mouse is currently over the element.  It is marked with HoveredClass
//   - highlighted: The element is to be emphasized (see below).  It is marked with HighlightClass.
//
// When a node or edge is selected:
//   - highlight the end-to-end paths (nodes and edges) for which the element participates.
//   - dim the unhighlighted elements
//   - hovering is ignored while an element is selected
//
// When a box is selected:
//   - highlight the contained nodes and their related nodes (including edges).
//
// When no element is selected and a node is hovered:
//   - mark the node, and only that node, as Hovered and Highlighted.
//   - all other elements are undecorated.
//
// When no element is selected and an edge is hovered:
//   - mark the edge, and only that edge, as Hovered and Highlighted.
//   - mark the source and destination nodes as Highlighted.
//   - all other elements are undecorated.
//
// When a boxed node is highlighted it's surrounding boxes are highlighted as well.
//
// Note that this code is responsible only for maintaining the element class assignments, the actual
// visualization changes, given the class assignments, is up to GraphStyles.ts.
//
export class GraphHighlighter {
  cy: any;
  selected: CytoscapeBaseEvent;
  hovered?: CytoscapeBaseEvent;

  constructor(cy: any) {
    this.cy = cy;
    this.selected = {
      summaryType: 'graph',
      summaryTarget: this.cy
    };
  }

  // Need to define these methods using the "public class fields syntax", to be able to keep
  // *this* binded when passing it to events handlers (or use the annoying syntax)
  // https://reactjs.org/docs/handling-events.html
  onClick = (event: CytoscapeBaseEvent) => {
    // ignore clicks on the currently selected element
    if (this.selected.summaryTarget === event.summaryTarget) {
      return;
    }

    this.selected = event;
    this.clearHover();
    this.unhighlight();

    // only highlight when selecting something other than the graph background
    if (this.selected.summaryType !== 'graph') {
      this.refresh();
    }
  };

  clearHover = () => {
    if (this.hovered) {
      this.hovered.summaryTarget.removeClass(HoveredClass);
      this.hovered = undefined;
    }
  };

  onMouseIn = (event: CytoscapeBaseEvent) => {
    // only set Hovered when the graph is currently selected, otherwise just leave the selected element as-is
    if (this.selected.summaryType === 'graph' && ['node', 'edge', 'box'].includes(event.summaryType)) {
      this.hovered = event;
      this.hovered.summaryTarget.addClass(HoveredClass);
      this.refresh();
    }
  };

  onMouseOut = (event: CytoscapeBaseEvent) => {
    if (this.hovered && this.hovered.summaryTarget === event.summaryTarget) {
      this.clearHover();
      this.unhighlight();
    }
  };

  unhighlight = () => {
    this.cy.elements(`.${DimClass}`).removeClass(DimClass);
    this.cy.elements(`.${HighlightClass}`).removeClass(HighlightClass);
  };

  refresh = () => {
    const highlighted = this.getHighlighted();
    if (!highlighted.toHighlight) {
      return;
    }

    highlighted.toHighlight.addClass(HighlightClass);

    if (highlighted.dimOthers) {
      this.cy.elements().difference(highlighted.toHighlight).addClass(DimClass);
    }
  };

  // Returns the nodes to highlight. Highlighting for a hovered element
  // is limited to its neighborhood.  Highlighting for a selected element
  // is extended to full inbound and outbound paths.
  getHighlighted(): { toHighlight: any; dimOthers: boolean } {
    const isHover = this.selected.summaryType === 'graph';
    const event = isHover ? this.hovered : this.selected;
    if (event) {
      switch (event.summaryType) {
        case 'node':
          return { toHighlight: this.getNodeHighlight(event.summaryTarget, isHover), dimOthers: true };
        case 'edge':
          return { toHighlight: this.getEdgeHighlight(event.summaryTarget, isHover), dimOthers: true };
        case 'box':
          return this.getBoxHighlight(event.summaryTarget, isHover);
        default:
        // fall through
      }
    }
    return { toHighlight: undefined, dimOthers: false };
  }

  includeAncestorNodes(nodes: any) {
    return nodes.reduce((all, current) => {
      all = all.add(current);
      if (current.isChild()) {
        all = all.add(current.ancestors());
      }
      return all;
    }, this.cy.collection());
  }

  getNodeHighlight(node: any, isHover: boolean) {
    const elems = isHover ? node.closedNeighborhood() : node.predecessors().add(node.successors());
    return this.includeAncestorNodes(elems.add(node));
  }

  getEdgeHighlight(edge: any, isHover: boolean) {
    const source = edge.source();
    const target = edge.target();
    let elems = source.add(target);

    if (!isHover) {
      elems = elems.add(source.predecessors()).add(target.successors());
    }
    return this.includeAncestorNodes(elems.add(edge));
  }

  getBoxHighlight(box: any, isHover: boolean): { toHighlight: any; dimOthers: boolean } {
    // treat App boxes in a typical way, but to reduce "flashing", Namespace and Cluster
    // boxes highlight themselves and their anscestors.
    if (box.data(CyNode.isBox) === BoxByType.APP) {
      let elems;
      if (isHover) {
        elems = box.descendants().reduce((prev, child) => {
          return prev.add(child.closedNeighborhood());
        }, this.cy.collection());
      } else {
        const children = box.descendants();
        elems = children.add(children.predecessors()).add(children.successors());
      }
      return { toHighlight: this.includeAncestorNodes(elems), dimOthers: true };
    }
    return { toHighlight: this.includeAncestorNodes(box), dimOthers: false };
  }
}
