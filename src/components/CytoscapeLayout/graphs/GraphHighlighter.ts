import { CytoscapeClickEvent } from './../CytoscapeLayout';

const DIM_CLASS: string = 'mousedim';

export class GraphHighlighter {
  cy: any;
  selected: CytoscapeClickEvent;

  constructor(cy: any) {
    this.cy = cy;
  }

  // Need to define these methods using the "public class fields syntax", to be able to keep
  // *this* binded when passing it to events handlers (or use the anoying syntax)
  // https://reactjs.org/docs/handling-events.html
  onClick = (event: CytoscapeClickEvent) => {
    this.selected = event;
    this.refresh();
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

  getHighlighted() {
    if (this.selected === null || this.selected.summaryType === 'graph') {
      return this.cy.elements();
    } else if (this.selected.summaryType === 'group') {
      return this.getGroupHighlight(this.selected.summaryTarget);
    } else if (this.selected.summaryType === 'node') {
      return this.getNodeHighlight(this.selected.summaryTarget);
    } else if (this.selected.summaryType === 'edge') {
      return this.getEdgeHighlight(this.selected.summaryTarget);
    }
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
