import { Point, clamp, quadraticBezier, linearInterpolation, distance, bezierLength } from '../../../utils/MathUtils';
import { UnhighlightClass, HoveredClass } from '../graphs/GraphStyles';
import { PFColorVals } from '../../Pf/PfColors';
import {
  TrafficPointCircleRenderer,
  TrafficPointConcentricDiamondRenderer,
  TrafficPointRenderer,
  Diamond
} from './TrafficPointRenderer';
import { decoratedEdgeData } from '../CytoscapeGraphUtils';
import { Protocol } from '../../../types/Graph';
import { timerConfig, tcpTimerConfig } from './AnimationTimerConfig';

// Clamp response time from min to max
const SPEED_RESPONSE_TIME_MIN = 0;
const SPEED_RESPONSE_TIME_MAX = 10000;

// Speed to travel trough an edge
const SPEED_RATE_MIN = 0.1;
const SPEED_RATE_MAX = 2.0;

const TCP_SPEED = 1;

const BASE_LENGTH = 50;

// How often paint a frame
const FRAME_RATE = 1 / 60;

enum EdgeConnectionType {
  LINEAR,
  CURVE,
  LOOP
}

enum TrafficEdgeType {
  RPS, // requests-per-second (includes http, grpc)
  TCP, // bytes-per-second
  NONE
}

/**
 * Returns a TrafficPointRenderer for an RPS error point
 * @param edge
 * @returns {TrafficPointRenderer}
 */
const getTrafficPointRendererForRpsError: (edge: any) => TrafficPointRenderer = (_edge: any) => {
  return new TrafficPointConcentricDiamondRenderer(
    new Diamond(5, PFColorVals.White, PFColorVals.Danger, 1.0),
    new Diamond(2, PFColorVals.Danger, PFColorVals.Danger, 1.0)
  );
};

/**
 * Returns a TrafficPointRenderer for a RPS success point
 * @param edge
 * @returns {TrafficPointRenderer}
 */
const getTrafficPointRendererForRpsSuccess: (edge: any) => TrafficPointRenderer = (edge: any) => {
  return new TrafficPointCircleRenderer(2, PFColorVals.White, edge.style('line-color'), 2);
};

/**
 * Returns a TrafficPointRenderer for a Tcp point
 * @param edge
 * @returns {TrafficPointCircleRenderer}
 */
const getTrafficPointRendererForTcp: (edge: any) => TrafficPointRenderer = (_edge: any) => {
  return new TrafficPointCircleRenderer(1.6, PFColorVals.Black100, PFColorVals.Black500, 1);
};

/**
 * Traffic Point, it defines in an edge
 * speed - defines how fast the point is going to travel from the start to the end
 *  of the edge. Is a rate of the edge length traveled by second.
 *  1 means that the edge is traveled in exactly 1 second.
 *  0.5 is 2 seconds, 2 is half a second, etc.
 * delta - defines in what part of the edge is the point,  is a normalized number
 *  from 0 to 1, 0 means at the start of the path, and 1 is the end. The position
 *  is interpolated.
 * offset - Offset to add to the rendered point position.
 * renderer - Renderer used to draw the shape at a given position.
 */
type TrafficPoint = {
  speed: number;
  delta: number;
  offset: Point;
  renderer: TrafficPointRenderer;
};

/**
 * Helps generate traffic points
 * timer - defines how fast to generate a new point, its in milliseconds.
 * timerForNextPoint - keeps track of how many milliseconds to generate the next point.
 * speed - defines the speed of the next point (see TrafficPoint.speed)
 */
class TrafficPointGenerator {
  private timer?: number;
  private timerForNextPoint?: number;
  private speed: number = 0;
  private errorRate: number = 0;
  private type: TrafficEdgeType = TrafficEdgeType.NONE;

  /**
   * Process a render step for the generator, decrements the timerForNextPoint and
   * returns a new point if it reaches zero (or is close).
   * This method adds some randomness to avoid the "flat" look that all the points
   * are synchronized.
   */
  processStep(step: number, edge: any): TrafficPoint | undefined {
    if (this.timerForNextPoint !== undefined) {
      this.timerForNextPoint -= step;
      // Add some random-ness to make it less "flat"
      if (this.timerForNextPoint <= Math.random() * 200) {
        this.timerForNextPoint = this.timer;
        return this.nextPoint(edge);
      }
    }
    return undefined;
  }

  setTimer(timer: number | undefined) {
    this.timer = timer;
    // Start as soon as posible, unless we have no traffic
    if (this.timerForNextPoint === undefined) {
      this.timerForNextPoint = timer;
    }
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  setErrorRate(errorRate: number) {
    this.errorRate = errorRate;
  }

  setType(type: TrafficEdgeType) {
    this.type = type;
  }

  private nextPoint(edge: any): TrafficPoint {
    let renderer;
    let offset;
    const isErrorPoint = Math.random() <= this.errorRate;
    if (this.type === TrafficEdgeType.RPS) {
      renderer = isErrorPoint ? getTrafficPointRendererForRpsError(edge) : getTrafficPointRendererForRpsSuccess(edge);
    } else if (this.type === TrafficEdgeType.TCP) {
      renderer = getTrafficPointRendererForTcp(edge);
      // Cheap way to put some offset around the edge, I think this is enough unless we want more accuracy
      // More accuracy would need to identify the slope of current segment of the edgge (for curves and loops) to only do
      // offsets perpendicular to it, instead of it, we are moving around a circle area
      // Random offset (x,y); 'x' in [-1.5, 1.5] and 'y' in [-1.5, 1.5]
      offset = { x: Math.random() * 3 - 1.5, y: Math.random() * 3 - 1.5 };
    }

    return {
      speed: this.speed,
      delta: 0, // at the beginning of the edge
      renderer: renderer,
      offset: offset
    };
  }
}

/**
 * Holds the list of points an edge has.
 * points - list of active points the edge has, points are discarded when they
 *  reach their target.
 * generator - Generates the next point
 * edge - Edge where the traffic is tracked
 */
class TrafficEdge {
  private points: Array<TrafficPoint> = [];
  private generator: TrafficPointGenerator;
  private edge: any;
  private type: TrafficEdgeType = TrafficEdgeType.NONE;

  constructor() {
    this.generator = new TrafficPointGenerator();
  }

  /**
   * Process a step for the Traffic Edge, increments the delta of the points
   * Calls `processStep` for the generator and adds a new point if any.
   */
  processStep(step: number) {
    this.points = this.points.map(p => {
      p.delta += (step * p.speed) / 1000;
      return p;
    });
    const point = this.generator.processStep(step, this.edge);
    if (point) {
      this.points.push(point);
    }
  }

  getPoints() {
    return this.points;
  }

  getEdge() {
    return this.edge;
  }

  getType() {
    return this.type;
  }

  setTimer(timer: number | undefined) {
    this.generator.setTimer(timer);
  }

  /**
   * When a point is 1 or over it, is time to discard it.
   */
  removeFinishedPoints() {
    this.points = this.points.filter(p => p.delta <= 1);
  }

  setSpeed(speed: number) {
    this.generator.setSpeed(speed);
  }

  setErrorRate(errorRate: number) {
    this.generator.setErrorRate(errorRate);
  }

  setEdge(edge: any) {
    this.edge = edge;
  }

  setType(type: TrafficEdgeType) {
    this.type = type;
    this.generator.setType(type);
  }
}

type TrafficEdgeHash = {
  [edgeId: string]: TrafficEdge;
};

/**
 * Renders the traffic going from edges using the edge information to compute
 * their rate and speed
 *
 * rate determines how often to put a TrafficPoint in the edge.
 * responseTime determines how fast the TrafficPoint should travel from the start to the end of the edge.
 * percentErr determine if the next TrafficPoint is error or not.
 */
export default class TrafficRenderer {
  private animationTimer;
  private previousTimestamp;
  private trafficEdges: TrafficEdgeHash = {};

  private readonly layer;
  private readonly context;

  constructor(cy: any) {
    this.layer = cy.cyCanvas();
    const canvas = this.layer.getCanvas();
    canvas.style['pointer-events'] = 'none';
    this.context = canvas.getContext('2d');
  }

  /**
   * Starts the rendering loop, discards any other rendering loop that was started
   */
  start(edges: any) {
    this.pause();
    this.trafficEdges = this.processEdges(edges);
    this.animationTimer = window.setInterval(this.processStep, FRAME_RATE * 1000);
  }

  /**
   * Stops the rendering loop if any
   */
  pause() {
    if (this.animationTimer !== undefined) {
      window.clearInterval(this.animationTimer);
      this.layer.clear(this.context);
      this.animationTimer = undefined;
      this.previousTimestamp = undefined;
    }
  }

  /**
   * Stops the rendering loop if any
   */
  stop() {
    this.pause();
    this.trafficEdges = {};
  }

  /**
   * Process a step, clears the canvas, sets the graph transformation to render
   * every dot.
   */
  processStep = () => {
    try {
      const nextTimestamp = Date.now();
      if (!this.previousTimestamp) {
        this.previousTimestamp = nextTimestamp;
      }
      const step = this.currentStep(nextTimestamp);
      this.layer.clear(this.context);
      this.layer.setTransform(this.context);
      Object.keys(this.trafficEdges).forEach(edgeId => {
        const trafficEdge = this.trafficEdges[edgeId];
        const edge = trafficEdge.getEdge();
        // Skip if edge is currently hidden or removed
        if (edge.visible() && edge.inside()) {
          trafficEdge.processStep(step);
          trafficEdge.removeFinishedPoints();
          this.render(trafficEdge);
        }
      });
      this.previousTimestamp = nextTimestamp;
    } catch (exception) {
      // If a step failed, the next step is likely to fail.
      // Stop the rendering and throw the exception
      this.stop();
      throw exception;
    }
  };

  /**
   * Renders the points inside the TrafficEdge (unless unhighlighted)
   *
   */
  private render(trafficEdge: TrafficEdge) {
    const edge = trafficEdge.getEdge();
    if (edge.hasClass(UnhighlightClass) || edge.hasClass(HoveredClass)) {
      return;
    }
    trafficEdge.getPoints().forEach((point: TrafficPoint) => {
      const controlPoints = this.edgeControlPoints(edge);
      try {
        const pointInGraph = this.pointWithOffset(this.pointInGraph(controlPoints, point.delta), point.offset);

        if (pointInGraph) {
          point.renderer.render(this.context, pointInGraph);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.log(`Error rendering TrafficEdge, it won't be rendered: ${error.message}`);
        }
      }
    });
  }

  private pointInGraph(controlPoints: Array<Point>, t: number) {
    /*
     * Control points are build so that if you have p0, p1, p2, p3, p4 points, you need to build 2 quadratic bezier:
     * 1) p0 (t=0), p1 (t=0.5) and p2 (t=1) and 2) p2 (t=0), p3 (t=0.5) and p4 (t=1)
     * p0 and p4 (or pn) are always the source and target of an edge.
     * Commonly there is only 2 points for straight lines, 3  points for curves and 5 points for loops.
     * Not going to generalize them now to avoid having a more complex code that is needed.
     * https://github.com/cytoscape/cytoscape.js/issues/2139#issuecomment-398473432
     */
    const edgeConnectionType = this.edgeConnectionTypeFromControlPoints(controlPoints);
    switch (edgeConnectionType) {
      case EdgeConnectionType.LINEAR:
        return linearInterpolation(controlPoints[0], controlPoints[1], t);
      case EdgeConnectionType.CURVE:
        return quadraticBezier(controlPoints[0], controlPoints[1], controlPoints[2], t);
      case EdgeConnectionType.LOOP:
        // Find the local t depending the current step
        if (t < 0.5) {
          // Normalize [0, 0.5)
          return quadraticBezier(controlPoints[0], controlPoints[1], controlPoints[2], t / 0.5);
        } else {
          // Normalize [0.5, 1]
          return quadraticBezier(controlPoints[2], controlPoints[3], controlPoints[4], (t - 0.5) * 2);
        }
      default:
        throw Error('Unhandled EdgeConnectionType:' + edgeConnectionType);
    }
  }

  private pointWithOffset(point: Point, offset: Point) {
    return offset === undefined ? point : { x: point.x + offset.x, y: point.y + offset.y };
  }

  private currentStep(currentTime: number): number {
    const step = currentTime - this.previousTimestamp;
    return step === 0 ? FRAME_RATE * 1000 : step;
  }

  private getTrafficEdgeType(edge: any) {
    switch (decoratedEdgeData(edge).protocol) {
      case Protocol.GRPC:
      case Protocol.HTTP:
        return TrafficEdgeType.RPS;
      case Protocol.TCP:
        return TrafficEdgeType.TCP;
      default:
        return TrafficEdgeType.NONE;
    }
  }

  private processEdges(edges: any): TrafficEdgeHash {
    timerConfig.resetCalibration();
    tcpTimerConfig.resetCalibration();
    // Calibrate animation amplitude
    edges.forEach(edge => {
      const edgeData = decoratedEdgeData(edge);
      switch (edgeData.protocol) {
        case Protocol.GRPC:
          timerConfig.calibrate(edgeData.grpc);
          break;
        case Protocol.HTTP:
          timerConfig.calibrate(edgeData.http);
          break;
        case Protocol.TCP:
          tcpTimerConfig.calibrate(edgeData.tcp);
          break;
      }
    });
    // Process edges
    return edges.reduce((trafficEdges: TrafficEdgeHash, edge: any) => {
      const type = this.getTrafficEdgeType(edge);
      if (type !== TrafficEdgeType.NONE) {
        const edgeId = decoratedEdgeData(edge).id;
        if (edgeId in this.trafficEdges) {
          trafficEdges[edgeId] = this.trafficEdges[edgeId];
        } else {
          trafficEdges[edgeId] = new TrafficEdge();
        }
        trafficEdges[edgeId].setType(type);
        this.fillTrafficEdge(edge, trafficEdges[edgeId]);
      }
      return trafficEdges;
    }, {});
  }

  private fillTrafficEdge(edge: any, trafficEdge: TrafficEdge) {
    // Need to identify if we are going to fill an RPS or TCP traffic edge
    // RPS traffic has rate, responseTime, percentErr (among others) where TCP traffic only has: tcpSentRate

    let edgeLengthFactor = 1;
    try {
      const edgeLength = this.edgeLength(edge);
      edgeLengthFactor = BASE_LENGTH / Math.max(edgeLength, 1);
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Error when finding the length of the edge for the traffic animation, this TrafficEdge won't be rendered: ${error.message}`
        );
      }
    }

    const edgeData = decoratedEdgeData(edge);
    if (trafficEdge.getType() === TrafficEdgeType.RPS) {
      const isHttp = edgeData.protocol === Protocol.HTTP;
      const rate = isHttp ? edgeData.http : edgeData.grpc;
      const pErr = isHttp ? edgeData.httpPercentErr : edgeData.grpcPercentErr;

      const timer = timerConfig.computeDelay(rate);
      // The edge of the length also affects the speed, include a factor in the speed to even visual speed for
      // long and short edges.
      const speed = this.speedFromResponseTime(edgeData.responseTime) * edgeLengthFactor;
      const errorRate = isNaN(pErr) ? 0 : pErr / 100;
      trafficEdge.setSpeed(speed);
      trafficEdge.setTimer(timer);
      trafficEdge.setEdge(edge);
      trafficEdge.setErrorRate(errorRate);
    } else if (trafficEdge.getType() === TrafficEdgeType.TCP) {
      trafficEdge.setSpeed(TCP_SPEED * edgeLengthFactor);
      trafficEdge.setErrorRate(0);
      trafficEdge.setTimer(tcpTimerConfig.computeDelay(edgeData.tcp));
      trafficEdge.setEdge(edge);
    }
  }

  private speedFromResponseTime(responseTime: number) {
    // Consider NaN response time as "everything is going as fast as possible"
    if (isNaN(responseTime)) {
      return SPEED_RATE_MAX;
    }
    // Normalize
    const delta = clamp(responseTime, SPEED_RESPONSE_TIME_MIN, SPEED_RESPONSE_TIME_MAX) / SPEED_RESPONSE_TIME_MAX;
    // Scale
    return SPEED_RATE_MIN + (1 - delta) * (SPEED_RATE_MAX - SPEED_RATE_MIN);
  }

  private edgeLength(edge: any) {
    const controlPoints = this.edgeControlPoints(edge);
    const edgeConnectionType = this.edgeConnectionTypeFromControlPoints(controlPoints);
    switch (edgeConnectionType) {
      case EdgeConnectionType.LINEAR:
        return distance(controlPoints[0], controlPoints[1]);
      case EdgeConnectionType.CURVE:
        return bezierLength(controlPoints[0], controlPoints[1], controlPoints[2]);
      case EdgeConnectionType.LOOP:
        return (
          bezierLength(controlPoints[0], controlPoints[1], controlPoints[2]) +
          bezierLength(controlPoints[2], controlPoints[3], controlPoints[4])
        );
      default:
        throw Error('Unhandled EdgeConnectionType:' + edgeConnectionType);
    }
  }

  private edgeControlPoints(edge: any) {
    const controlPoints: Array<Point> = [edge.sourceEndpoint()];
    const rawControlPoints = edge.controlPoints();
    if (rawControlPoints) {
      for (let i = 0; i < rawControlPoints.length; ++i) {
        controlPoints.push(rawControlPoints[i]);
        // If there is a next point, we are going to use the midpoint for the next point
        if (i + 1 < rawControlPoints.length) {
          controlPoints.push({
            x: (rawControlPoints[i].x + rawControlPoints[i + 1].x) / 2,
            y: (rawControlPoints[i].y + rawControlPoints[i + 1].y) / 2
          });
        }
      }
    }
    controlPoints.push(edge.targetEndpoint());
    return controlPoints;
  }

  private edgeConnectionTypeFromControlPoints(controlPoints: Array<Point>) {
    if (controlPoints.length === 2) {
      return EdgeConnectionType.LINEAR;
    } else if (controlPoints.length === 3) {
      return EdgeConnectionType.CURVE;
    } else if (controlPoints.length === 5) {
      return EdgeConnectionType.LOOP;
    } else {
      throw Error('Unknown EdgeConnectionType, ControlPoint.length=' + controlPoints.length);
    }
  }
}
