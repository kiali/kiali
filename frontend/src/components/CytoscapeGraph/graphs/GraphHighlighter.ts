import { BoxByType, CytoscapeBaseEvent, NodeAttr } from '../../../types/Graph';
import { UnhighlightClass, HoveredClass, HighlightClass } from './GraphStyles';

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
    this.clearHighlighting();

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
      this.clearHighlighting();
    }
  };

  clearHighlighting = () => {
    this.cy.elements(`.${UnhighlightClass}`).removeClass(UnhighlightClass);
    this.cy.elements(`.${HighlightClass}`).removeClass(HighlightClass);
  };

  refresh = () => {
    const highlighted = this.getHighlighted();
    if (!highlighted.toHighlight) {
      return;
    }

    highlighted.toHighlight.addClass(HighlightClass);

    if (highlighted.unhighlightOthers) {
      this.cy.elements().difference(highlighted.toHighlight).addClass(UnhighlightClass);
    }
  };

  // Returns the nodes to highlight. Highlighting for a hovered or selected element
  // is the same, it extends to full inbound and outbound paths.
  getHighlighted(): { toHighlight: any; unhighlightOthers: boolean } {
    const isHover = this.selected.summaryType === 'graph';
    const event = isHover ? this.hovered : this.selected;
    if (event) {
      switch (event.summaryType) {
        case 'node':
          return { toHighlight: this.getNodeHighlight(event.summaryTarget, false), unhighlightOthers: true };
        case 'edge':
          return { toHighlight: this.getEdgeHighlight(event.summaryTarget, false), unhighlightOthers: true };
        case 'box':
          return this.getBoxHighlight(event.summaryTarget, false);
        default:
        // fall through
      }
    }
    return { toHighlight: undefined, unhighlightOthers: false };
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

  getNodeHighlight(node: any, neighborhoodOnly: boolean) {
    const elems = neighborhoodOnly ? node.closedNeighborhood() : node.predecessors().add(node.successors());
    return this.includeAncestorNodes(elems.add(node));
  }

  getEdgeHighlight(edge: any, neighborhoodOnly: boolean) {
    const source = edge.source();
    const target = edge.target();
    let elems = source.add(target);

    if (!neighborhoodOnly) {
      elems = elems.add(source.predecessors()).add(target.successors());
    }
    return this.includeAncestorNodes(elems.add(edge));
  }

  getBoxHighlight(box: any, neighborhoodOnly: boolean): { toHighlight: any; unhighlightOthers: boolean } {
    // treat App boxes in a typical way, but to reduce "flashing", Namespace and Cluster
    // boxes highlight themselves and their anscestors.
    if (box.data(NodeAttr.isBox) === BoxByType.APP) {
      let elems;
      if (neighborhoodOnly) {
        elems = box.descendants().reduce((prev, child) => {
          return prev.add(child.closedNeighborhood());
        }, this.cy.collection());
      } else {
        const children = box.descendants();
        elems = children.add(children.predecessors()).add(children.successors());
      }
      return { toHighlight: this.includeAncestorNodes(elems), unhighlightOthers: true };
    }
    return { toHighlight: this.includeAncestorNodes(box), unhighlightOthers: false };
  }
}
