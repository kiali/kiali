import { Point, clamp, quadraticBezier, linearInterpolation, distance, bezierLength } from '../../../utils/MathUtils';
import { DimClass } from './GraphStyles';
import { PfColors } from '../../../components/Pf/PfColors';

// Min and max values to clamp the request per second rate
const TIMER_REQUEST_PER_SECOND_MIN = 0;
const TIMER_REQUEST_PER_SECOND_MAX = 750;

// Range of time to use between spawning a new dot.
// At higher request per second rate, faster dot spawning.
const TIMER_TIME_BETWEEN_DOTS_MIN = 20;
const TIMER_TIME_BETWEEN_DOTS_MAX = 2000;

// Clamp response time from min to max
const SPEED_RESPONSE_TIME_MIN = 0;
const SPEED_RESPONSE_TIME_MAX = 10;

// Speed to travel trough an edge
const SPEED_RATE_MIN = 0.1;
const SPEED_RATE_MAX = 2.0;

const BASE_LENGTH = 50;

// How often paint a frame
const FRAME_RATE = 1 / 60;

enum PointShape {
  CIRCLE,
  DIAMOND
}

enum EdgeConnectionType {
  LINEAR,
  CURVE,
  LOOP
}

const TRAFFIC_POINT_ERROR_SHAPE = PointShape.DIAMOND;
const TRAFFIC_POINT_ERROR_COLOR = PfColors.Red100;
const TRAFFIC_POINT_DEFAULT_SHAPE = PointShape.CIRCLE;
const TRAFFIC_POINT_DEFAULT_COLOR = PfColors.Black;

const TRAFFIC_POINT_RADIO = 3;

/**
 * Traffic Point, it defines in an edge
 * speed - defines how fast the point is going to travel from the start to the end
 *  of the edge. Is a rate of the edge length traveled by second.
 *  1 means that the edge is traveled in exactly 1 second.
 *  0.5 is 2 seconds, 2 is half a second, etc.
 * delta - defines in what part of the edge is the point,  is a normalized number
 *  from 0 to 1, 0 means at the start of the path, and 1 is the end. The position
 *  is interpolated.
 * shape - The shape of the point (see: PointShape)
 * color - The color of the point in the format #RRGGBBAA
 */
type TrafficPoint = {
  speed: number;
  delta: number;
  shape: PointShape;
  color: string;
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
  private speed: number;
  private errorRate: number;

  // If timer is undefined, no point is going to be generated, ideal when traffic is zero
  constructor(speed: number, timer: number | undefined, errorRate: number) {
    this.speed = speed;
    this.timer = timer;
    this.errorRate = errorRate;
    // Start as soon as posible, unless we have no traffic
    this.timerForNextPoint = this.timer === undefined ? undefined : 0;
  }

  /**
   * Process a render step for the generator, decrements the timerForNextPoint and
   * returns a new point if it reaches zero (or is close).
   * This method adds some randomness to avoid the "flat" look that all the points
   * are syncronized.
   */
  processStep(step: number): TrafficPoint | undefined {
    if (this.timerForNextPoint !== undefined) {
      this.timerForNextPoint -= step;
      // Add some random-ness to make it less "flat"
      if (this.timerForNextPoint <= Math.random() * 200) {
        this.timerForNextPoint = this.timer;
        return this.nextPoint();
      }
    }
    return undefined;
  }

  setTimer(timer: number | undefined) {
    this.timer = timer;
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

  private nextPoint(): TrafficPoint {
    const isErrorPoint = Math.random() <= this.errorRate;
    return {
      speed: this.speed,
      delta: 0, // at the beginning of the edge
      color: isErrorPoint ? TRAFFIC_POINT_ERROR_COLOR : TRAFFIC_POINT_DEFAULT_COLOR,
      shape: isErrorPoint ? TRAFFIC_POINT_ERROR_SHAPE : TRAFFIC_POINT_DEFAULT_SHAPE
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

  constructor(speed: number, timer: number | undefined, errorRate: number, edge: any) {
    this.generator = new TrafficPointGenerator(speed, timer, errorRate);
    this.edge = edge;
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
    const point = this.generator.processStep(step);
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
}

type TrafficEdgeHash = {
  [edgeId: string]: TrafficEdge;
};

/**
 * Renders the traffic going from edges using the edge information to compute
 * their rate and speed
 */
export default class TrafficRenderer {
  private animationTimer;
  private previousTimestamp;
  private trafficEdges: TrafficEdgeHash = {};

  private readonly layer;
  private readonly canvas;
  private readonly context;

  constructor(cy: any, edges: any) {
    this.layer = cy.cyCanvas();
    this.canvas = this.layer.getCanvas();
    this.context = this.canvas.getContext('2d');
    this.setEdges(edges);
  }

  /**
   * Starts the rendering loop, discards any other rendering loop that was started
   */
  start() {
    this.stop();
    this.animationTimer = window.setInterval(this.processStep, FRAME_RATE * 1000);
  }

  /**
   * Stops the rendering loop if any
   */
  stop() {
    if (this.animationTimer) {
      window.clearInterval(this.animationTimer);
      this.animationTimer = undefined;
      this.clear();
    }
  }

  setEdges(edges: any) {
    this.trafficEdges = this.processEdges(edges);
  }

  clear() {
    this.layer.clear(this.context);
  }

  /**
   * Process a step, clears the canvas, sets the graph transformation to render
   * every dot.
   */
  processStep = () => {
    try {
      if (this.previousTimestamp === undefined) {
        this.previousTimestamp = Date.now();
      }
      const nextTimestamp = Date.now();
      const step = this.currentStep(nextTimestamp);
      this.layer.clear(this.context);
      this.layer.setTransform(this.context);
      Object.keys(this.trafficEdges).forEach(edgeId => {
        const trafficEdge = this.trafficEdges[edgeId];
        trafficEdge.processStep(step);
        trafficEdge.removeFinishedPoints();
        this.render(trafficEdge);
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
   * Renders the points inside the TrafficEdge (unless is dimmed)
   *
   */
  private render(trafficEdge: TrafficEdge) {
    const edge = trafficEdge.getEdge();
    if (edge.hasClass(DimClass)) {
      return;
    }
    trafficEdge.getPoints().forEach((point: TrafficPoint) => {
      const controlPoints = this.edgeControlPoints(edge);
      try {
        const pointInGraph = this.pointInGraph(controlPoints, point.delta);

        if (pointInGraph) {
          this.renderPoint(point, pointInGraph.x, pointInGraph.y, TRAFFIC_POINT_RADIO);
        }
      } catch (error) {
        console.log(`Error rendering TrafficEdge, it won't be rendered: ${error.message}`);
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

  private renderPoint(point: TrafficPoint, x: number, y: number, radio: number) {
    this.context.fillStyle = point.color;
    this.context.beginPath();
    switch (point.shape) {
      case PointShape.CIRCLE:
        this.context.arc(x, y, radio, 0, 2 * Math.PI, true);
        break;
      case PointShape.DIAMOND:
        this.context.moveTo(x, y - radio);
        this.context.lineTo(x + radio, y);
        this.context.lineTo(x, y + radio);
        this.context.lineTo(x - radio, y);
        break;
      default:
        throw Error('Unknown shape ' + point.shape);
    }
    this.context.fill(); // or stroke if we only want the outer ring
  }

  private currentStep(currentTime: number): number {
    const step = currentTime - this.previousTimestamp;
    return step === 0 ? FRAME_RATE * 1000 : step;
  }

  private processEdges(edges: any): TrafficEdgeHash {
    return edges.reduce((trafficEdges: TrafficEdgeHash, edge: any) => {
      const edgeId = edge.data('id');
      const timer = this.timerFromRate(edge.data('rate'));
      let edgeLengthFactor = 1;
      try {
        const edgeLength = this.edgeLength(edge);
        edgeLengthFactor = BASE_LENGTH / Math.max(edgeLength, 1);
      } catch (error) {
        console.error(
          `Error when finding the length of the edge for the traffic animation, this TrafficEdge won't be rendered: ${
            error.message
          }`
        );
      }

      // The edge of the length also affects the speed, include a factor in the speed to even visual speed for
      // long and short edges.
      const speed = this.speedFromResponseTime(edge.data('responseTime')) * edgeLengthFactor;
      const errorRate = edge.data('percentErr') === undefined ? 0 : edge.data('percentErr') / 100;
      if (edgeId in this.trafficEdges) {
        const trafficEdge = this.trafficEdges[edgeId];
        trafficEdge.setTimer(timer);
        trafficEdge.setSpeed(speed);
        trafficEdge.setEdge(edge);
        trafficEdge.setErrorRate(errorRate);
        trafficEdges[edgeId] = trafficEdge;
      } else {
        trafficEdges[edgeId] = new TrafficEdge(speed, timer, errorRate, edge);
      }
      return trafficEdges;
    }, {});
  }

  // see for easing functions https://gist.github.com/gre/1650294
  private timerFromRate(rate: number) {
    if (isNaN(rate) || rate === 0) {
      return undefined;
    }
    // Normalize requests per second within a range
    const delta =
      clamp(rate, TIMER_REQUEST_PER_SECOND_MIN, TIMER_REQUEST_PER_SECOND_MAX) / TIMER_REQUEST_PER_SECOND_MAX;

    // Invert and scale
    return (
      TIMER_TIME_BETWEEN_DOTS_MIN + Math.pow(1 - delta, 2) * (TIMER_TIME_BETWEEN_DOTS_MAX - TIMER_TIME_BETWEEN_DOTS_MIN)
    );
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
