import { CytoscapeClickEvent, CytoscapeMouseInEvent, CytoscapeMouseOutEvent } from './../CytoscapeLayout';

const DIM_CLASS: string = 'mousedim';

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
  // *this* binded when passing it to events handlers (or use the anoying syntax)
  // https://reactjs.org/docs/handling-events.html
  onClick = (event: CytoscapeClickEvent) => {
    this.selected = event;
    this.refresh();
  };

  onMouseIn = (event: CytoscapeMouseInEvent) => {
    if (this.selected.summaryType === 'graph' && ['node', 'edge', 'group'].indexOf(event.summaryType) !== -1) {
      this.hovered = event;
      this.refresh();
    }
  };

  onMouseOut = (event: CytoscapeMouseOutEvent) => {
    if (this.hovered !== undefined && this.hovered.summaryTarget === event.summaryTarget) {
      this.hovered = undefined;
      this.refresh();
    }
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
  refresh() {
    this.cy.elements('.' + DIM_CLASS).removeClass(DIM_CLASS);
    let toHighlight = this.getHighlighted();
    if (toHighlight === null) {
      toHighlight = this.cy.elements();
    }

    this.cy
      .elements()
      .difference(toHighlight)
      .filter((ele: any) => {
        return !ele.isParent();
      })
      .addClass(DIM_CLASS);
  }

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
    if (event !== undefined) {
      if (event.summaryType === 'node') {
        return this.getNodeHighlight(event.summaryTarget);
      } else if (event.summaryType === 'edge') {
        return this.getEdgeHighlight(event.summaryTarget);
      } else if (event.summaryType === 'group') {
        return this.getGroupHighlight(event.summaryTarget);
      }
    }
    return this.cy.elements();
  }

  // return their children
  // and related nodes to children (including edges)
  getGroupHighlight(groupBox: any) {
    return groupBox.children().reduce((prev, child) => {
      if (prev === undefined) {
        prev = this.cy.collection();
      }
      return prev.add(child.closedNeighborhood());
    });
  }

  getNodeHighlight(node: any) {
    return node.closedNeighborhood();
  }

  getEdgeHighlight(edge: any) {
    return edge.connectedNodes().add(edge);
  }
}
