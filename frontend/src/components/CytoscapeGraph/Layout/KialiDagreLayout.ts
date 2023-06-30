/*
  KialiDagreLayout

  This is a version of the "dagre" algorithm provided by Cytoscape at
  https://github.com/cytoscape/cytoscape.js-dagre/blob/master/src/layout.js

  The standard algorithm needs some refinements for Kiali use cases and in this case it's simpler to clone it
  rather than provide an extension.

 */

import dagre from 'dagre';

const defaults = {
  // dagre algo options, uses default value on undefined
  nodeSep: undefined, // the separation between adjacent nodes in the same rank
  edgeSep: undefined, // the separation between adjacent edges in the same rank
  rankSep: undefined, // the separation between adjacent nodes in the same rank
  rankDir: undefined, // 'TB' for top to bottom flow, 'LR' for left to right,
  align: undefined, // alignment for rank nodes. Can be 'UL', 'UR', 'DL', or 'DR', where U = up, D = down, L = left, and R = right
  acyclicer: undefined, // If set to 'greedy', uses a greedy heuristic for finding a feedback arc set for a graph.
  // A feedback arc set is a set of edges that can be removed to make a graph acyclic.
  ranker: undefined, // Type of algorithm to assigns a rank to each node in the input graph.
  // Possible values: network-simplex, tight-tree or longest-path
  minLen: function (_edge) {
    return 1;
  }, // number of ranks to keep between the source and target of the edge
  edgeWeight: function (_edge) {
    return 1;
  }, // higher weight edges are generally made shorter and straighter than lower weight edges

  // general layout options
  fit: true, // whether to fit to viewport
  padding: 30, // fit padding
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  nodeDimensionsIncludeLabels: false, // whether labels should be included in determining the space used by a node
  animate: false, // whether to transition the node positions
  animateFilter: function (_node, _i) {
    return true;
  }, // whether to animate specific nodes when animation is on; non-animated nodes immediately go to their final positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  transform: function (_node, pos) {
    return pos;
  }, // a function that applies a transform to the final node position
  ready: function () {}, // on layoutready
  stop: function () {} // on layoutstop
};

const isFunction = function (o) {
  return typeof o === 'function';
};

export class KialiDagreLayout {
  readonly cy;
  readonly eles;
  readonly options;

  constructor(options: any) {
    this.cy = options.cy;
    this.eles = options.eles;
    this.options = Object.assign({}, defaults, options);
  }

  /**
   * This code gets executed on the cy.layout(...).  run() is the entrypoint of this algorithm.
   */
  run() {
    var cy = this.cy;
    var eles = this.eles;
    var options = this.options;

    var getVal = function (ele, val) {
      return isFunction(val) ? val.apply(ele, [ele]) : val;
    };

    var bb = options.boundingBox || { x1: 0, y1: 0, w: cy.width(), h: cy.height() };
    if (bb.x2 === undefined) {
      bb.x2 = bb.x1 + bb.w;
    }
    if (bb.w === undefined) {
      bb.w = bb.x2 - bb.x1;
    }
    if (bb.y2 === undefined) {
      bb.y2 = bb.y1 + bb.h;
    }
    if (bb.h === undefined) {
      bb.h = bb.y2 - bb.y1;
    }

    var g = new dagre.graphlib.Graph({
      multigraph: true,
      compound: true
    });

    var gObj = {};
    var setGObj = function (name, val) {
      if (val != null) {
        gObj[name] = val;
      }
    };

    setGObj('nodesep', options.nodeSep);
    setGObj('edgesep', options.edgeSep);
    setGObj('ranksep', options.rankSep);
    setGObj('rankdir', options.rankDir);
    setGObj('align', options.align);
    setGObj('ranker', options.ranker);
    setGObj('acyclicer', options.acyclicer);

    g.setGraph(gObj);

    g.setDefaultEdgeLabel(function () {
      return {};
    });
    g.setDefaultNodeLabel(function () {
      return {};
    });

    // add nodes to dagre
    var nodes = eles.nodes();
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var nbb = node.layoutDimensions(options);

      g.setNode(node.id(), {
        width: nbb.w,
        height: nbb.h,
        name: node.id()
      });
    }

    // set compound parents
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];

      if (node.isChild()) {
        g.setParent(node.id(), node.parent().id());
      }
    }

    // add edges to dagre
    var edges = eles.edges().stdFilter(function (edge) {
      return !edge.source().isParent() && !edge.target().isParent(); // dagre can't handle edges on compound nodes
    });

    for (i = 0; i < edges.length; i++) {
      var edge = edges[i];

      g.setEdge(
        edge.source().id(),
        edge.target().id(),
        {
          minlen: getVal(edge, options.minLen),
          weight: getVal(edge, options.edgeWeight),
          name: edge.id()
        },
        edge.id()
      );
    }

    dagre.layout(g);

    var gNodeIds = g.nodes();
    for (i = 0; i < gNodeIds.length; i++) {
      var id = gNodeIds[i];
      var n = g.node(id);

      cy.getElementById(id).scratch().dagre = n;
    }

    var dagreBB;

    if (options.boundingBox) {
      dagreBB = { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity };
      nodes.forEach(function (node) {
        let dModel = node.scratch().dagre;

        dagreBB.x1 = Math.min(dagreBB.x1, dModel.x);
        dagreBB.x2 = Math.max(dagreBB.x2, dModel.x);

        dagreBB.y1 = Math.min(dagreBB.y1, dModel.y);
        dagreBB.y2 = Math.max(dagreBB.y2, dModel.y);
      });

      dagreBB.w = dagreBB.x2 - dagreBB.x1;
      dagreBB.h = dagreBB.y2 - dagreBB.y1;
    } else {
      dagreBB = bb;
    }

    var constrainPos = function (p) {
      if (options.boundingBox) {
        let xPct = dagreBB.w === 0 ? 0 : (p.x - dagreBB.x1) / dagreBB.w;
        let yPct = dagreBB.h === 0 ? 0 : (p.y - dagreBB.y1) / dagreBB.h;

        return {
          x: bb.x1 + xPct * bb.w,
          y: bb.y1 + yPct * bb.h
        };
      } else {
        return p;
      }
    };

    nodes.layoutPositions(this, options, function (ele) {
      let dModel = ele.scratch().dagre;

      return constrainPos({
        x: dModel.x,
        y: dModel.y
      });
    });

    return this;
  }

  /**
   * This is a stub required by cytoscape to allow the layout impl to emit events
   * @param _events space separated string of event names
   */
  emit(_events) {
    // intentionally empty
  }
}
