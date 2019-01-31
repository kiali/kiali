import { CytoscapeClickEvent, CytoscapeMouseInEvent, CytoscapeMouseOutEvent } from '../../../types/Graph';
import { DimClass } from './GraphStyles';

const DIM_CLASS: string = DimClass;
const HIGHLIGHT_CLASS: string = 'mousehighlight';
const HOVERED_CLASS: string = 'mousehover';

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
    this.hovered = undefined;
    this.unhighlight();

    // only highlight when selecting something other than the graph background
    if (this.selected.summaryType !== 'graph') {
      this.refresh();
    }
  };

  onMouseIn = (event: CytoscapeMouseInEvent) => {
    // only highlight on hover when the graph is currently selected, otherwise leave the
    // selected element highlighted
    if (this.selected.summaryType === 'graph' && ['node', 'edge', 'group'].indexOf(event.summaryType) !== -1) {
      this.hovered = event;
      this.hovered.summaryTarget.addClass(HOVERED_CLASS);
      this.refresh();
    }
  };

  onMouseOut = (event: CytoscapeMouseOutEvent) => {
    if (this.hovered && this.hovered.summaryTarget === event.summaryTarget) {
      this.hovered.summaryTarget.removeClass(HOVERED_CLASS);
      this.hovered = undefined;
      this.unhighlight();
    }
  };

  unhighlight = () => {
    this.cy.elements('.' + DIM_CLASS).removeClass(DIM_CLASS);
    this.cy.elements('.' + HIGHLIGHT_CLASS).removeClass(HIGHLIGHT_CLASS);
  };

  // When you click a service node, that node and the nodes it connects (including the edges)
  // remain the same, but all other nodes and edges will get dimmed, thus highlighting
  // the clicked node and its "neighborhood".
  //
  // When you click an edge (i.e. a connector betwen nodes), that edge and
  // the nodes it connects will remain the same, but all others will get dimmed,
  // thus highlighting the clicked edge and its nodes.
  //
  // Note that we never dim the service group box elements. We know an element is a group box if its isParent() returns true.
  // When a service group box element is selected, we will highlight the nodes it contain,
  // their related nodes (including edges).
  refresh = () => {
    const toHighlight = this.getHighlighted();
    if (!toHighlight) {
      return;
    }

    toHighlight
      .filter((ele: any) => {
        return !ele.isParent();
      })
      .addClass(HIGHLIGHT_CLASS);

    this.cy
      .elements()
      .difference(toHighlight)
      .addClass(DIM_CLASS);
  };

  // Returns the nodes to highlight depending the selected or hovered summaryType
  // If current selected is 'graph' (e.g. no selection):
  //  Check if we are hovering on a node or edge and hover those relations
  // If current selected is something else, highlight that node (group, node or edge)
  getHighlighted() {
    if (this.selected.summaryType === 'graph') {
      return this.getHighlightedByEvent(this.hovered);
    }
    return this.getHighlightedByEvent(this.selected);
  }

  getHighlightedByEvent(event: CytoscapeClickEvent | CytoscapeMouseInEvent | undefined) {
    if (event) {
      if (event.summaryType === 'node') {
        return this.getNodeHighlight(event.summaryTarget);
      } else if (event.summaryType === 'edge') {
        return this.getEdgeHighlight(event.summaryTarget);
      } else if (event.summaryType === 'group') {
        return this.getGroupHighlight(event.summaryTarget);
      }
    }
    return undefined;
  }

  includeParentNodes(nodes: any) {
    return nodes.reduce((all, current) => {
      all = all.add(current);
      if (current.isChild()) {
        all = all.add(current.parent());
      }
      return all;
    }, this.cy.collection());
  }

  // return the children and children relations, including edges
  getGroupHighlight(groupBox: any) {
    return this.includeParentNodes(
      groupBox.children().reduce((prev, child) => {
        return prev.add(child.closedNeighborhood());
      }, this.cy.collection())
    );
  }

  getNodeHighlight(node: any) {
    return this.includeParentNodes(node.closedNeighborhood());
  }

  getEdgeHighlight(edge: any) {
    return this.includeParentNodes(edge.connectedNodes().add(edge));
  }
}
