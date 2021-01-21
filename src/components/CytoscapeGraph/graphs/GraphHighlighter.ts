import { CytoscapeClickEvent, CytoscapeMouseInEvent, CytoscapeMouseOutEvent } from '../../../types/Graph';
import { DimClass, HoveredClass, HighlightClass } from './GraphStyles';

// When a node or edge is selected we highlight the end-to-end paths (nodes and edges) for which the
// element participates.  Other nodes and edges are dimmed.
//
// When no node or edge is selected, hovering on a node or edge will highlight it and its neighborhood. Other
// nodes and edges are dimmed.
//
// When a box is selected, we will highlight the contained nodes and their related nodes (including edges).
export class GraphHighlighter {
  cy: any;
  selected: CytoscapeClickEvent;
  hovered?: CytoscapeMouseInEvent;

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
  onClick = (event: CytoscapeClickEvent) => {
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

  onMouseIn = (event: CytoscapeMouseInEvent) => {
    // only highlight on hover when the graph is currently selected, otherwise leave the
    // selected element highlighted
    if (this.selected.summaryType === 'graph' && ['node', 'edge', 'box'].indexOf(event.summaryType) !== -1) {
      this.hovered = event;
      this.hovered.summaryTarget.addClass(HoveredClass);
      this.refresh();
    }
  };

  onMouseOut = (event: CytoscapeMouseOutEvent) => {
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
    const toHighlight = this.getHighlighted();
    if (!toHighlight) {
      return;
    }

    toHighlight.addClass(HighlightClass);

    this.cy.elements().difference(toHighlight).addClass(DimClass);
  };

  // Returns the nodes to highlight. Highlighting for a hovered element
  // is limited to its neighborhood.  Highlighting for a selected element
  // is extended to full incoming and outgoing paths.
  getHighlighted() {
    const isHover = this.selected.summaryType === 'graph';
    const event = isHover ? this.hovered : this.selected;
    if (event) {
      switch (event.summaryType) {
        case 'node':
          return this.getNodeHighlight(event.summaryTarget, isHover);
        case 'edge':
          return this.getEdgeHighlight(event.summaryTarget, isHover);
        case 'box':
          return this.getBoxHighlight(event.summaryTarget, isHover);
        default:
        // fall through
      }
    }
    return undefined;
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
    let elems;
    if (isHover) {
      elems = edge.connectedNodes();
    } else {
      const source = edge.source();
      const target = edge.target();
      elems = source.add(target).add(source.predecessors()).add(target.successors());
    }
    return this.includeAncestorNodes(elems.add(edge));
  }

  getBoxHighlight(box: any, isHover: boolean) {
    let elems;
    if (isHover) {
      elems = box.descendants().reduce((prev, child) => {
        return prev.add(child.closedNeighborhood());
      }, this.cy.collection());
    } else {
      const children = box.descendants();
      elems = children.add(children.predecessors()).add(children.successors());
    }
    return this.includeAncestorNodes(elems);
  }
}
