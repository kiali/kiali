import { clamp } from '../../../utils/MathUtils';
import { DimClass } from './GraphStyles';
import { PfColors } from '../../../components/Pf/PfColors';

// Min and max values to clamp the request per second rate
const TIMER_REQUEST_PER_SECOND_MIN = 0;
const TIMER_REQUEST_PER_SECOND_MAX = 2000;

// Range of time to use between spawning a new dot.
// At higher request per second rate, faster dot spawning.
const TIMER_TIME_BETWEEN_DOTS_MIN = 20;
const TIMER_TIME_BETWEEN_DOTS_MAX = 4000;

// Clamp latency from min to max
const SPEED_LATENCY_MIN = 0;
const SPEED_LATENCY_MAX = 10;

// Speed to travel trough an edge
const SPEED_RATE_MIN = 0.1;
const SPEED_RATE_MAX = 2.0;

// How often paint a frame
const FRAME_RATE = 1 / 60;

/**
 * Traffic Point, it defines in an edge
 * speed - defines how fast the point is going to travel from the start to the end
 *  of the edge. Is a rate of the edge length traveled by second.
 *  1 means that the edge is traveled in exactly 1 second.
 *  0.5 is 2 seconds, 2 is half a second, etc.
 * delta - defines in what part of the edge is the point,  is a normalized number
 *  from 0 to 1, 0 means at the start of the path, and 1 is the end. The position
 *  is interpolated.
 */
type TrafficPoint = {
  speed: number;
  delta: number;
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

  // If timer is undefined, no point is going to be generated, ideal when traffic is zero
  constructor(speed: number, timer: number | undefined) {
    this.speed = speed;
    this.timer = timer;
    this.timerForNextPoint = 0; // Start as soon as posible
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
        return { speed: this.speed, delta: 0 };
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

  constructor(speed: number, timer: number | undefined, edge: any) {
    this.generator = new TrafficPointGenerator(speed, timer);
    this.edge = edge;
  }

  /**
   * Process a step for the Traffic Edge, increments the delta of the points
   * Calls `processStep` for the generator and adds a new point if any.
   */
  processStep(step: number) {
    this.points = this.points.map(p => {
      p.delta += step * p.speed / 1000;
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

  private layer;
  private canvas;
  private context;

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
      // If there are curved edges, we will need to use edge.controlPoints or
      // edge.segmentPoints to compute the path
      const source = edge.sourceEndpoint();
      const target = edge.targetEndpoint();
      const x = source.x + (target.x - source.x) * point.delta;
      const y = source.y + (target.y - source.y) * point.delta;
      this.context.beginPath();
      this.context.arc(x, y, 2, 0, 2 * Math.PI, true);
      this.context.fillStyle = PfColors.Black;
      this.context.fill(); // or stroke if we only want the outer ring
    });
  }

  private currentStep(currentTime: number): number {
    const step = currentTime - this.previousTimestamp;
    return step === 0 ? FRAME_RATE * 1000 : step;
  }

  private processEdges(edges: any): TrafficEdgeHash {
    return edges.reduce((trafficEdges: TrafficEdgeHash, edge: any) => {
      const edgeId = edge.data('id');
      const timer = this.timerFromRate(edge.data('rate'));
      const speed = this.speedFromLatency(edge.data('latency'));
      if (edgeId in this.trafficEdges) {
        const trafficEdge = this.trafficEdges[edgeId];
        trafficEdge.setTimer(timer);
        trafficEdge.setSpeed(speed);
        trafficEdge.setEdge(edge);
        trafficEdges[edgeId] = trafficEdge;
      } else {
        trafficEdges[edgeId] = new TrafficEdge(speed, timer, edge);
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
    return TIMER_TIME_BETWEEN_DOTS_MIN + (1 - delta) * (TIMER_TIME_BETWEEN_DOTS_MAX - TIMER_TIME_BETWEEN_DOTS_MIN);
  }

  private speedFromLatency(latency: number) {
    // Consider NaN latency as "everything is going as fast as possible"
    if (isNaN(latency)) {
      return SPEED_RATE_MIN;
    }
    // Normalize
    const delta = clamp(latency, SPEED_LATENCY_MIN, SPEED_LATENCY_MAX) / SPEED_LATENCY_MAX;
    // Scale
    return SPEED_RATE_MIN + (1 - delta) * (SPEED_RATE_MAX - SPEED_RATE_MIN);
  }
}
