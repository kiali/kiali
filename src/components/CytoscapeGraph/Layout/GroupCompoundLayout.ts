/*
  GroupCompoundLayout

  This is a synthetic layout that helps to layout close to each other the contents of compound nodes,
  in this way we ensure that the compound node itself is as small as possible, avoiding overlaps with other nodes.

  It requires a real layout to do the actual work, but there are some patches applied to the graph before and after the
  real layout is run.

  Is composed of:
   - A compound layout (dagre in this case) does the layout of the children of a compound node.
   - A Synthetic edge generator to help with the creation of synthetic edges (more info below).
   - The actual GroupCompoundLayout class which is type of cy Layout and can be used along it.

  The algorithm is roughly as follow:

  1. For every compound node:
    a. The compound layout is run for every compound and their relative positions (to the parent) are saved for later use.
    b. Get the resulting bounding box of the compound, set the width and height of the node using `cy.style`, so that
       the real layout honors the size when doing the layout.
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
    b. Set the relative position to parent of every children -saved in 1.a-

 */

export const COMPOUND_PARENT_NODE_CLASS = '__compoundLayoutParentNodeClass';

const NAMESPACE_KEY = 'group_compound_layout';
const CHILDREN_KEY = NAMESPACE_KEY + 'children';
const STYLES_KEY = NAMESPACE_KEY + 'styles';
const RELATIVE_POSITION_KEY = NAMESPACE_KEY + 'relative_position';

// We can't fully rely on the reported position of the compound nodes, as they are relative to contents
// Since we are moving a lots of params without waiting for a refresh (maybe related that we are in a batch) we are
// computing this value using the bounding box, for the parents we use the bounding box of all the elements.
// The position is the center of the box, so we are using the top left corner and adding half the width / height.
const positionFromBoundingBox = boundingBox => {
  return {
    x: boundingBox.x1 + boundingBox.w * 0.5,
    y: boundingBox.y1 + boundingBox.h * 0.5
  };
};

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

    if (sourceId === targetId) {
      return false;
    }

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
 * Main class for the GroupCompoundLayout, used to bridge with cytoscape to make it easier to integrate with current code
 */
export default class GroupCompoundLayout {
  readonly options;
  readonly cy;
  readonly elements;
  readonly syntheticEdgeGenerator;

  constructor(options: any) {
    this.options = { ...options };
    this.cy = this.options.cy;
    this.elements = this.options.eles;
    this.syntheticEdgeGenerator = new SyntheticEdgeGenerator();
  }

  /**
   * This code gets executed on the cy.layout(...).run() is our entrypoint of this algorithm.
   */
  run() {
    const { realLayout, compoundLayoutOptions } = this.options;
    const parents = this.parents();

    // (1.a) Prepare parents by assigning a size and running the compound layout
    parents.each(parent => {
      const children = parent.children();
      const targetElements = children.add(children.edgesTo(children));

      // We expect a discrete layout here
      const compoundLayout = targetElements.layout(compoundLayoutOptions);
      compoundLayout.on('layoutstart layoutready layoutstop', _evt => {
        // Avoid to propagate any local layout events up to cy, this would yield a global operation when not all nodes are ready.
        return false;
      });
      compoundLayout.run();

      // Starting from cytoscape 3.4.3, When setting cy.json and this "run" (because we call boundingBox) function in
      // the same batch throws an error  "trying to access x of undefined". This might be a bug or I'm doing something
      // wrong here, the way to workaround this is to have the run outside of a batch operation,
      // see https://github.com/cytoscape/cytoscape.js/issues/2402
      const boundingBox = targetElements.boundingBox();

      const parentPosition = positionFromBoundingBox(boundingBox);

      // Save the relative positions, as we will need them later.
      parent.children().each(child => {
        // Need to build the relativePosition.
        // For some reason we can't trust our current relativePosition and position of the parent node
        // It might be related that we are running in a batch operation or something else.
        // Luckily we can build our own relativePosition with the parent and children boundingBox
        const childPosition = positionFromBoundingBox(child.boundingBox());
        const relativePosition = {
          x: childPosition.x - parentPosition.x,
          y: childPosition.y - parentPosition.y
        };

        // Can't use scratchPad here because we are going to remove this element.
        child.data(RELATIVE_POSITION_KEY, relativePosition);
      });

      const backupStyles: OverridenStyles = {
        shape: parent.style('shape'),
        height: parent.style('height'),
        width: parent.style('width')
      };

      const newStyles: OverridenStyles = {
        shape: 'rectangle',
        height: `${boundingBox.h}px`,
        width: `${boundingBox.w}px`
      };
      // Saves a backup of current styles to restore them after we finish
      parent.scratch(STYLES_KEY, backupStyles);
      parent.addClass(COMPOUND_PARENT_NODE_CLASS);
      // (1.b) Set the size
      parent.style(newStyles);
      // Save the children as jsons in the parent scratchpad for later
      parent.scratch(CHILDREN_KEY, parent.children().jsons());
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
    layout.one('layoutstop', _event => {
      // This part of the code needs to be executed inside a batch to work, else the relative position is not correctly
      // updated
      this.cy.startBatch();
      // (3) Remove synthetic edges
      this.cy.remove(syntheticEdges);

      // Add and position the children nodes according to the layout
      parents.each(parent => {
        // (4.a) Add back the children and the edges
        this.cy.add(parent.scratch(CHILDREN_KEY));
        // (4.b) Layout the children using our compound layout.
        parent.children().each(child => {
          const relativePosition = child.data(RELATIVE_POSITION_KEY);
          child.relativePosition(relativePosition);
          child.removeData(RELATIVE_POSITION_KEY);
        });

        parent.style(parent.scratch(STYLES_KEY));
        parent.removeClass(COMPOUND_PARENT_NODE_CLASS);

        // Discard the saved values
        parent.removeScratch(CHILDREN_KEY);
        parent.removeScratch(STYLES_KEY);
      });
      // (4.a) Add the real edges, we already added the children nodes.
      this.cy.add(
        this.cy
          .collection()
          .add(elementsToRemove)
          .edges()
      );
      this.cy.endBatch();
    });
    layout.run();
  }

  parents() {
    return this.elements.nodes('$node > node');
  }
}
