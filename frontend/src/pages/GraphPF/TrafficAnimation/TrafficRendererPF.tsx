import { Point, clamp, distance } from '../../../utils/MathUtils';
import {
  TrafficPointCircleRenderer,
  TrafficPointDiamondRenderer,
  TrafficPointRenderer
} from './TrafficPointRendererPF';
import { Protocol } from '../../../types/Graph';
import { timerConfig, tcpTimerConfig } from './AnimationTimerConfig';
import { Controller, Edge } from '@patternfly/react-topology';
import { EdgeData } from 'pages/GraphPF/GraphPFElems';
import { PFColors } from 'components/Pf/PfColors';
import { setObserved } from 'helpers/GraphHelpers';

// Clamp response time from min to max
const SPEED_RESPONSE_TIME_MIN = 0;
const SPEED_RESPONSE_TIME_MAX = 10000;

// Speed to travel trough an edge
const SPEED_RATE_MIN = 0.1;
const SPEED_RATE_MAX = 2.0;

const TCP_SPEED = 1;

const BASE_LENGTH = 50;

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
const getTrafficPointRendererForRpsError: (edge: Edge, animationDuration: string) => TrafficPointRenderer = (
  _edge: Edge,
  animationDuration
) => {
  return new TrafficPointDiamondRenderer(animationDuration, 4, PFColors.White, PFColors.Danger);
};

/**
 * Returns a TrafficPointRenderer for a RPS success point
 * @param edge
 * @returns {TrafficPointRenderer}
 */
const getTrafficPointRendererForRpsSuccess: (edge: Edge, animationDuration: string) => TrafficPointRenderer = (
  edge: Edge,
  animationDuration
) => {
  return new TrafficPointCircleRenderer(animationDuration, 4, PFColors.White, edge.getData().pathStyle.stroke);
};

/**
 * Returns a TrafficPointRenderer for a Tcp point
 * @param edge
 * @returns {TrafficPointCircleRenderer}
 */
const getTrafficPointRendererForTcp: (edge: Edge, animationDuration: string) => TrafficPointRenderer = (
  edge: Edge,
  animationDuration
) => {
  return new TrafficPointCircleRenderer(animationDuration, 3.2, PFColors.Black200, edge.getData().pathStyle.stroke);
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
export class TrafficPointGenerator {
  private timer?: number;
  private speed: number = 0;
  private errorRate: number = 0;
  private type: TrafficEdgeType = TrafficEdgeType.NONE;

  render(edge: Edge): React.ReactFragment {
    const pointDurationSeconds = 1.0 / this.speed;
    const numPointsOnEdge = Math.ceil(pointDurationSeconds / this.timer!);
    const pointDuration = `${pointDurationSeconds}s`;

    const renderer =
      this.type === TrafficEdgeType.RPS
        ? getTrafficPointRendererForRpsSuccess(edge, pointDuration)
        : getTrafficPointRendererForTcp(edge, pointDuration);
    const errorRenderer =
      this.type === TrafficEdgeType.RPS ? getTrafficPointRendererForRpsError(edge, pointDuration) : undefined;
    const repeat = this.errorRate === 0 || this.errorRate === 100;
    console.log(`${edge.getId()} repeat=${repeat} numPointsOnEdge=${numPointsOnEdge} pointDuration=${pointDuration}`);

    const points: Array<React.SVGProps<SVGElement>> = [];
    for (let i = 0; i < numPointsOnEdge; ++i) {
      const isErrorPoint = errorRenderer && Math.random() <= this.errorRate;
      const animationDelay = `${i * this.timer!}ms`;
      const renew = !repeat && i + 1 === numPointsOnEdge;
      // console.log(`point ${edge.getId()} renew=${renew}`);
      const point = isErrorPoint
        ? errorRenderer.render(edge, animationDelay, repeat, renew ? this.renewAnimation(edge) : undefined)
        : renderer.render(edge, animationDelay, repeat, renew ? this.renewAnimation(edge) : undefined);
      points.unshift(point);
      /*
      if (renew) {
        this.renewAnimation(edge, (i + 1) * this.timer! + pointDurationSeconds * 1000)(point as any);
      }
     */
    }

    return <>{points.map(p => p)}</>;
  }

  // renewAnimation performs an innocuous "set" to force the edge to re-render and generate new points
  private renewAnimation(edge: Edge, delay?: number): React.AnimationEventHandler {
    return _elem => {
      console.log(`setTimeout scheduled! ${edge.getId()} delay=${delay?.toFixed(2)}`);
      window.setTimeout(() => {
        console.log(`setTimeout executing! ${edge.getId()} `);
        setObserved(() => edge.setData({ ...edge.getData(), animationTime: Date.now() }));
      }, delay);
    };
  }

  setTimer(timer: number | undefined) {
    this.timer = timer;
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  // error rate 0..1 (1 = 100%)
  setErrorRate(errorRate: number) {
    this.errorRate = errorRate;
  }

  setType(type: TrafficEdgeType) {
    this.type = type;
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
  private edge: Edge;
  private type: TrafficEdgeType = TrafficEdgeType.NONE;

  constructor(edge: Edge) {
    this.edge = edge;
    this.generator = new TrafficPointGenerator();
  }

  getPoints() {
    return this.points;
  }

  getEdge() {
    return this.edge;
  }

  getGenerator(): TrafficPointGenerator {
    return this.generator;
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

  setEdge(edge: Edge) {
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
 * Assigns to each edge the information needed to render the appropriate animation given the state of
 * the overall graph.
 * - rate determines how often to put a TrafficPoint in the edge.
 * - responseTime determines how fast the TrafficPoint should travel from the start to the end of the edge.
 * - percentErr determine if the next TrafficPoint is error or not.
 */
export class TrafficAnimation {
  private controller: Controller;

  constructor(controller: Controller) {
    this.controller = controller;
  }

  /**
   * Starts an animation, discarding any prior animation
   */
  start() {
    console.log('start');
    this.processEdges(this.controller.getGraph().getEdges());
  }

  private processEdges(edges: Edge[]) {
    const visibleEdges = edges.filter(e => e.isVisible());

    timerConfig.resetCalibration();
    tcpTimerConfig.resetCalibration();

    // Calibrate animation amplitude
    visibleEdges.forEach(edge => {
      const edgeData = edge.getData() as EdgeData;
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

    // assign animation values
    const trafficAnimation = visibleEdges.reduce((trafficEdges: TrafficEdgeHash, edge: Edge) => {
      const edgeData = edge.getData() as EdgeData;
      const type = this.getTrafficEdgeType(edgeData);
      if (type !== TrafficEdgeType.NONE) {
        const edgeId = edge.getId();
        trafficEdges[edgeId] = new TrafficEdge(edge);
        trafficEdges[edgeId].setType(type);
        this.fillTrafficEdge(edge, trafficEdges[edgeId]);
      }
      return trafficEdges;
    }, {});

    setObserved(() => {
      edges.forEach(e => {
        const trafficEdge = trafficAnimation[e.getId()];
        e.setData({ ...e.getData(), animation: trafficEdge ? trafficEdge.getGenerator() : undefined });
      });
    });
  }

  /**
   * Stops the animation
   */
  stop() {
    console.log('stop');
    setObserved(() => {
      this.controller
        .getGraph()
        .getEdges()
        .forEach(e => e.setData({ ...e.getData(), animation: undefined }));
    });
  }

  private getTrafficEdgeType(edgeData: EdgeData) {
    switch (edgeData.protocol) {
      case Protocol.GRPC:
      case Protocol.HTTP:
        return TrafficEdgeType.RPS;
      case Protocol.TCP:
        return TrafficEdgeType.TCP;
      default:
        return TrafficEdgeType.NONE;
    }
  }

  private fillTrafficEdge(edge: Edge, trafficEdge: TrafficEdge) {
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

    const edgeData = edge.getData() as EdgeData;
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

  private edgeLength(edge: Edge): number {
    let len = 0;
    const points = this.edgePoints(edge);
    for (let i = 0; i < points.length - 1; ++i) {
      len += distance(points[i], points[i + 1]);
    }
    return len;
  }

  private edgePoints(edge: Edge): Array<Point> {
    const controlPoints: Array<Point> = [edge.getStartPoint()];
    controlPoints.push(...edge.getBendpoints());
    controlPoints.push(edge.getEndPoint());
    return controlPoints;
  }
}
