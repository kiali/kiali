/*
  GroupCompoundLayout

  This is a synthetic layout that helps to layout close to each other the contents of compound nodes,
  in this way we ensure that the compound node itself is as small as possible, avoiding overlaps with other nodes.

  It requires a real layout to do the actual work, but there are some patches applied to the graph before and after the
  real layout is run.

  Is composed of:
   - A compound layout (see included VerticalLayout class) that does the layout of the children of a compound node.
   - A Synthetic edge generator to help with the creation of synthetic edges (more info below).
   - The actual GroupCompoundLayout class which is type of cy Layout and can be used along it.

  The algorithm is roughly as follow:

  1. For every compound node:
    a. Compute how much size is required depending on our compound layout -In the included VerticalLayout we sum up the
       height of each children plus a padding between each child-.
    b. With the size of the compound, set the width and height of the node using `cy.style`, so that the real layout
       honors the size when doing the layout.
    c. For every edge that goes to a child (or comes from a child), create a synthetic edge that goes to (or comes from) the compound node and remove the original
       edge. We can cull away repeated edges as they are not needed.
    d. Remove the children. This is important, else cytoscape won't honor the size specified in previous step.
       "A compound parent node does not have independent dimensions (position and size), as those values are
       automatically inferred by the positions and dimensions of the descendant nodes."
       http://js.cytoscape.org/#notation/compound-nodes
  2. Run the real layout on this new graph and wait until it finishes.
  3. Remove the synthetic edges.
  4. For every original parent node:
    a. Add back its children and edges.
    b. Layout the children using the selected compound layout -In the included VerticalLayout, we stack vertically every children
       setting the relative position of each one to be on top of each other-.

 */

const NAMESPACE_KEY = '_group_compound_layout';
const BOUNDING_BOX = 'bounding-box';
const CHILDREN_KEY = 'children';
const STYLES_KEY = 'styles';
const BETWEEN_NODES_PADDING = 3;

// Styles used to have more control on how the compound nodes are going to be seen by the Layout algorithm.
interface OverridenStyles {
  shape: string;
  width: string;
  height: string;
}

/**
 * Synthetic edge generator takes care of creating edges without repeating the same edge (targetA -> targetB) twice
 */
class SyntheticEdgeGenerator {
  private nextId = 0;
  private generatedMap = {};

  public getEdge(source: any, target: any) {
    const sourceId = this.normalizeToParent(source).id();
    const targetId = this.normalizeToParent(target).id();
    const key = `${sourceId}->${targetId}`;

    if (this.generatedMap[key]) {
      return false;
    }

    this.generatedMap[key] = true;

    return {
      group: 'edges',
      data: {
        id: 'synthetic-edge-' + this.nextId++,
        source: sourceId,
        target: targetId
      }
    };
  }

  // Returns the parent if any or the element itself.
  private normalizeToParent(element: any) {
    return element.isChild() ? element.parent() : element;
  }
}

/**
 * CompoundLayout interface, used to plug in to the GroupCompoundLayout other kinds of layouts for the contents of a
 * compound node. Examples to implement would be
 *   VerticalLayout:
 *    __________
 *   |          |
 *   | [ node ] |
 *   | [ node ] |
 *   | [ node ] |
 *   | [ node ] |
 *   |__________|
 *
 *   HorizontalLayout:
 *    ________________________________________
 *   |                                        |
 *   | [ node ]  [ node ]  [ node ]  [ node ] |
 *   |________________________________________|
 *
 *
 *   or a MatrixLayout:
 *    ____________________
 *   |                    |
 *   | [ node ]  [ node ] |
 *   | [ node ]  [ node ] |
 *   |____________________|
 *
 */
interface CompoundLayout {
  size(compound: any); // Gets the size required for this compound node to place every children
  layout(compound: any); // Layouts the children of this compound node.
}

/**
 * Implements a vertical layout for the children of a compound node.
 */
class VerticalLayout implements CompoundLayout {
  /**
   * This will get the size required for a vertical layout by:
   * adding all the heights of the contents plus a padding for every space between a node.
   * finding the max width value to use.
   */
  size(compound: any) {
    const size = compound.children().reduce(
      (accBoundingBox, child) => {
        const localBoundingBox = child.boundingBox();
        // The bounding box reported before adding and after adding differs, I think is related to removing/adding
        // in a batch, save that value for later
        child.data(NAMESPACE_KEY + BOUNDING_BOX, localBoundingBox);
        accBoundingBox.height += localBoundingBox.h;
        accBoundingBox.width = Math.max(accBoundingBox.width, localBoundingBox.w);
        return accBoundingBox;
      },
      { width: 0, height: 0 }
    );
    size.height += (compound.children().length - 1) * BETWEEN_NODES_PADDING;
    return size;
  }

  /**
   * This will layout the children using a vertical layout, starting on 0,0 we position the nodes relative to the parent
   * and saving the previous position to use as starting point for the news child.
   */
  layout(compound: any) {
    const position = { x: 0, y: 0 };
    compound.children().each(child => {
      // Retrieve saved bounding box to use, immediately delete as won't be used anymore.
      const boundingBox = child.data(NAMESPACE_KEY + BOUNDING_BOX);
      child.removeData(NAMESPACE_KEY + BOUNDING_BOX);
      // It looks like the relativePosition is given by the center, i haven't been able to confirm this (in the code) but
      // i'm using its bounding box to place it
      child.relativePosition({ x: position.x - boundingBox.w * 0.5, y: position.y - boundingBox.h * 0.5 });
      position.y += boundingBox.h + BETWEEN_NODES_PADDING;
    });
  }
}

/**
 * Main class for the GroupCompoundLayout, used to bridge with cytoscape to make it easier to integrate with current code
 */
export default class GroupCompoundLayout {
  readonly options;
  readonly cy;
  readonly elements;
  readonly syntheticEdgeGenerator;
  readonly compoundLayout: CompoundLayout;

  constructor(options: any) {
    this.options = { ...options };
    this.cy = this.options.cy;
    this.elements = this.options.eles;
    this.syntheticEdgeGenerator = new SyntheticEdgeGenerator();
    this.compoundLayout = new VerticalLayout();
  }

  /**
   * This code gets executed on the cy.layout(...).run() is our entrypoint of this algorithm.
   */
  run() {
    const { realLayout } = this.options;
    const parents = this.parents();

    // (1.a) Prepare parents by assigning a size
    parents.each(parent => {
      const boundingBox = this.compoundLayout.size(parent);
      const backupStyles: OverridenStyles = {
        shape: parent.style('shape'),
        height: parent.style('height'),
        width: parent.style('width')
      };

      const newStyles: OverridenStyles = {
        shape: 'rectangle',
        height: `${boundingBox.height}px`,
        width: `${boundingBox.width}px`
      };
      // Saves a backup of current styles to restore them after we finish
      this.setScratch(parent, STYLES_KEY, backupStyles);
      // (1.b) Set the size
      parent.style(newStyles);
      // Save the children as jsons in the parent scratchpad for later
      this.setScratch(parent, CHILDREN_KEY, parent.children().jsons());
    });

    //  Remove the children and its edges and add synthetic edges for every edge that touches a child node.
    let syntheticEdges = this.cy.collection();
    // Removed elements are being stored because later we will add them back.
    const elementsToRemove = parents.children().reduce((children, child) => {
      children.push(child);
      return children.concat(
        child.connectedEdges().reduce((edges, edge) => {
          // (1.c) Create synthetic edges.
          const syntheticEdge = this.syntheticEdgeGenerator.getEdge(edge.source(), edge.target());
          if (syntheticEdge) {
            syntheticEdges = syntheticEdges.add(this.cy.add(syntheticEdge));
          }
          edges.push(edge);
          return edges;
        }, [])
      );
    }, []);
    // (1.d) Remove children and edges that touch a child node.
    this.cy.remove(this.cy.collection().add(elementsToRemove));

    const layout = this.cy.layout({
      // Create a new layout
      ...this.options, // Sharing the main options
      name: realLayout, // but using the real layout
      eles: this.cy.elements(), // and the current elements
      realLayout: undefined // We don't want this realLayout stuff in there.
    });

    // (2) Add a one-time callback to be fired when the layout stops
    layout.one('layoutstop', event => {
      // (3) Remove synthetic edges
      this.cy.remove(syntheticEdges);

      // Add and position the children nodes according to the layout
      parents.each(parent => {
        // (4.a) Add back the children and the edges
        this.cy.add(this.getScratch(parent, CHILDREN_KEY));
        // (4.b) Layout the children using our compound layout.
        this.compoundLayout.layout(parent);
        parent.style(this.getScratch(parent, STYLES_KEY));

        // Discard the saved values
        this.setScratch(parent, CHILDREN_KEY, undefined);
        this.setScratch(parent, STYLES_KEY, undefined);
      });
      // (4.a) Add the real edges, we already added the children nodes.
      this.cy.add(
        this.cy
          .collection()
          .add(elementsToRemove)
          .edges()
      );
    });
    layout.run();
  }

  parents() {
    return this.elements.nodes('$node > node');
  }

  getScratch(element: any, key: string) {
    return element.scratch(NAMESPACE_KEY + key);
  }

  setScratch(element: any, key: string, value: any) {
    element.scratch(NAMESPACE_KEY + key, value);
  }
}
