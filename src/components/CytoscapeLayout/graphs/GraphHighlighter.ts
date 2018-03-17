const DIM_CLASS: string = 'mousedim';

export class GraphHighlighter {
  cy: any;
  groupBox: any;
  nodeOrEdge: any;

  constructor(cy: any) {
    this.cy = cy;
    this.cy.on('tap', this.onTapEvent);
    this.cy.on('mouseover', 'node,edge', this.onMouseOverNodeOrEdge);
    this.cy.on('mouseout', 'node,edge', this.onMouseOutNodeOrEdge);
  }

  // Need to define these methods using the "public class fields syntax", to be able to keep
  // *this* binded when passing it to events handlers (or use the anoying syntax)
  // https://reactjs.org/docs/handling-events.html
  onTapEvent = (event: any) => {
    const target = event.target;
    if (target === this.cy) {
      // the background was clicked
      if (this.groupBox == null) {
        return;
      }
      this.groupBox.unselect();
      this.groupBox = null;
      this.refresh();
    } else if (target.isParent()) {
      // A group box was clicked
      this.groupBox = target;
      this.refresh();
    } else {
      // a node or edge was clicked
      if (this.groupBox != null) {
        this.groupBox.unselect();
        this.groupBox = null;
      }
    }
  };

  onMouseOverNodeOrEdge = (event: any) => {
    if (event.target.isParent()) {
      return;
    }
    this.nodeOrEdge = event.target;
    this.refresh();
  };

  onMouseOutNodeOrEdge = (event: any) => {
    if (this.nodeOrEdge === event.target) {
      this.nodeOrEdge = null;
      this.refresh();
    }
  };

  // When you mouse over a service node, that node and the nodes it connects (including the edges)
  // remain the same, but all other nodes and edges will get dimmed, thus highlighting
  // the moused over node and its "neighborhood".
  //
  // When you mouse over an edge (i.e. a connector betwen nodes), that edge and
  // the nodes it connects will remain the same, but all others will get dimmed,
  // thus highlighting the moused over edge and its nodes.
  //
  // Note that we never dim the service group box elements (nor do we even process their
  // mouseout/mousein events). We know an element is a group box if its isParent() returns true.
  // When a service group box element is selected, we will highlight the nodes it contain,
  // their related nodes (including edges). Only those nodes will be affected by mouse over
  // until the service group box is deselected.
  refresh() {
    this.cy.elements('.' + DIM_CLASS).removeClass(DIM_CLASS);
    let toHighlight = this.getServiceCollection();
    if (toHighlight === null) {
      toHighlight = this.cy.elements();
    }
    const nodeOrEdgeCollection = this.getNodeOrEdgeCollection();
    if (nodeOrEdgeCollection !== null) {
      toHighlight = toHighlight.intersect(nodeOrEdgeCollection);
    }

    this.cy
      .elements()
      .difference(toHighlight)
      .filter((ele: any) => {
        return !ele.isParent();
      })
      .addClass(DIM_CLASS);
  }

  // If a service group box is selected, only return their children
  // and related nodes to children (including edges)
  // else returns null
  getServiceCollection() {
    if (this.groupBox == null) {
      return null;
    }
    return this.groupBox.children().reduce((prev, child) => {
      if (prev === undefined) {
        prev = this.cy.collection();
      }
      return prev.add(child.closedNeighborhood());
    });
  }

  // Returns the collection of related nodes to nodeOrEdge if any has the mouseover
  // else null;
  getNodeOrEdgeCollection() {
    if (this.nodeOrEdge != null) {
      if (this.nodeOrEdge.isNode()) {
        return this.nodeOrEdge.closedNeighborhood();
      } else {
        return this.nodeOrEdge.connectedNodes().add(this.nodeOrEdge);
      }
    }
    return null;
  }
}
