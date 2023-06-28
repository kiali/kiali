/*
  KialiConcentricLayout

  This is a version of the "concentric" algorithm provided by Cytoscape at
  https://github.com/cytoscape/cytoscape.js/blob/unstable/src/extensions/layout/concentric.js

  The standard algorithm needs some refinements for Kiali use cases and in this case it's simpler to clone it
  rather than provide an extension.

 */

// Original defaults from concentric.js
import { makeBoundingBox } from './KialiGridLayout';

const defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // the padding on fit
  startAngle: (3 / 2) * Math.PI, // where nodes start in radians
  sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
  clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
  equidistant: false, // whether levels have an equal radial distance betwen them, may cause bounding box overflow
  minNodeSpacing: 10, // min spacing between outside of nodes (used for radius adjustment)
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
  height: undefined, // height of layout area (overrides container height)
  width: undefined, // width of layout area (overrides container width)
  spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  concentric: function (node) {
    // returns numeric value for each node, placing higher nodes in levels towards the centre
    return node.degree();
  },
  levelWidth: function (nodes) {
    // the variation of concentric values in each level
    return nodes.maxDegree() / 4;
  },
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  animateFilter: function (_node, _i) {
    return true;
  }, // a function that determines whether the node should be animated.  All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  ready: undefined, // callback on layoutready
  stop: undefined, // callback on layoutstop
  transform: function (_node, position) {
    return position;
  } // transform a given node position. Useful for changing flow direction in discrete layouts
};

export class KialiConcentricLayout {
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
    var clockwise =
      this.options.counterclockwise !== undefined ? !this.options.counterclockwise : this.options.clockwise;

    var cy = this.cy;
    var eles = this.eles;
    var nodes = eles.nodes().not(':parent');

    var bb = makeBoundingBox(
      this.options.boundingBox
        ? this.options.boundingBox
        : {
            x1: 0,
            y1: 0,
            w: cy.width(),
            h: cy.height()
          }
    );

    var center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2
    };

    var nodeValues: any = []; // { node, value }
    var maxNodeSize = 0;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var value;

      // calculate the node value
      value = this.options.concentric(node);
      nodeValues.push({
        value: value,
        node: node
      });

      // for style mapping
      node._private.scratch.concentric = value;
    }

    // in case we used the `concentric` in style
    nodes.updateStyle();

    // calculate max size now based on potentially updated mappers
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      var nbb = node.layoutDimensions(this.options);

      maxNodeSize = Math.max(maxNodeSize, nbb.w, nbb.h);
    }

    // sort node values in descreasing order
    nodeValues.sort(function (a, b) {
      return b.value - a.value;
    });

    var levelWidth = this.options.levelWidth(nodes);

    // put the values into levels
    var levels: any = [[]];
    var currentLevel = levels[0];
    for (i = 0; i < nodeValues.length; i++) {
      var val = nodeValues[i];

      if (currentLevel.length > 0) {
        var diff = Math.abs(currentLevel[0].value - val.value);

        if (diff >= levelWidth) {
          currentLevel = [];
          levels.push(currentLevel);
        }
      }

      currentLevel.push(val);
    }

    // create positions from levels

    var minDist = maxNodeSize + this.options.minNodeSpacing; // min dist between nodes

    if (!this.options.avoidOverlap) {
      // then strictly constrain to bb
      var firstLvlHasMulti = levels.length > 0 && levels[0].length > 1;
      var maxR = Math.min(bb.w, bb.h) / 2 - minDist;
      var rStep = maxR / (levels.length + firstLvlHasMulti ? 1 : 0);

      minDist = Math.min(minDist, rStep);
    }

    // find the metrics for each level
    var r = 0;
    for (let i = 0; i < levels.length; i++) {
      var level = levels[i];
      var sweep = this.options.sweep === undefined ? 2 * Math.PI - (2 * Math.PI) / level.length : this.options.sweep;
      var dTheta = (level.dTheta = sweep / Math.max(1, level.length - 1));

      // calculate the radius
      if (level.length > 1 && this.options.avoidOverlap) {
        // but only if more than one node (can't overlap)
        var dcos = Math.cos(dTheta) - Math.cos(0);
        var dsin = Math.sin(dTheta) - Math.sin(0);
        var rMin = Math.sqrt((minDist * minDist) / (dcos * dcos + dsin * dsin)); // s.t. no nodes overlapping

        r = Math.max(rMin, r);
      }

      level.r = r;

      r += minDist;
    }

    if (this.options.equidistant) {
      var rDeltaMax = 0;
      r = 0;

      for (i = 0; i < levels.length; i++) {
        level = levels[i];
        var rDelta = level.r - r;

        rDeltaMax = Math.max(rDeltaMax, rDelta);
      }

      r = 0;
      for (i = 0; i < levels.length; i++) {
        level = levels[i];

        if (i === 0) {
          r = level.r;
        }

        level.r = r;

        r += rDeltaMax;
      }
    }

    // calculate the node positions
    var pos = {}; // id => position
    for (i = 0; i < levels.length; i++) {
      level = levels[i];
      dTheta = level.dTheta;
      r = level.r;

      for (var j = 0; j < level.length; j++) {
        val = level[j];
        var theta = this.options.startAngle + (clockwise ? 1 : -1) * dTheta * j;

        var p = {
          x: center.x + r * Math.cos(theta),
          y: center.y + r * Math.sin(theta)
        };

        pos[val.node.id()] = p;
      }
    }

    // position the nodes
    eles.nodes().layoutPositions(this, this.options, function (ele) {
      let id = ele.id();

      return pos[id];
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
