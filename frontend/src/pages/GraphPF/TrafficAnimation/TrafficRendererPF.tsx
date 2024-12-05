import { Point, clamp, distance } from '../../../utils/MathUtils';
import {
  TrafficPointCircleRenderer,
  TrafficPointDiamondRenderer,
  TrafficPointRenderer
} from './TrafficPointRendererPF';
import { Protocol } from '../../../types/Graph';
import { timerConfig, tcpTimerConfig } from './AnimationTimerConfig';
import { Controller, Edge, EdgeAnimationSpeed, EdgeStyle } from '@patternfly/react-topology';
import { EdgeData } from 'pages/GraphPF/GraphPFElems';
import { PFColors } from 'components/Pf/PfColors';
import { setObserved } from 'helpers/GraphHelpers';
import { serverConfig } from 'config';

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
const getTrafficPointRendererForRpsError: (
  edge: Edge,
  animationDuration: string,
  percentVisible: number
) => TrafficPointRenderer = (_edge: Edge, animationDuration: string, percentVisible: number) => {
  return new TrafficPointDiamondRenderer(animationDuration, percentVisible, 4, PFColors.White, PFColors.Danger);
};

/**
 * Returns a TrafficPointRenderer for a RPS success point
 * @param edge
 * @returns {TrafficPointRenderer}
 */
const getTrafficPointRendererForRpsSuccess: (
  edge: Edge,
  animationDuration: string,
  percentVisible: number
) => TrafficPointRenderer = (edge: Edge, animationDuration: string, percentVisible: number) => {
  return new TrafficPointCircleRenderer(
    animationDuration,
    percentVisible,
    4,
    PFColors.White,
    edge.getData().pathStyle.stroke
  );
};

/**
 * Returns a TrafficPointRenderer for a Tcp point
 * @param edge
 * @returns {TrafficPointCircleRenderer}
 */
const getTrafficPointRendererForTcp: (
  edge: Edge,
  animationDuration: string,
  percentVisible: number
) => TrafficPointRenderer = (edge: Edge, animationDuration: string, percentVisible: number) => {
  return new TrafficPointCircleRenderer(
    animationDuration,
    percentVisible,
    3.2,
    PFColors.Black200,
    edge.getData().pathStyle.stroke
  );
};

/**
 * Traffic Point, it defines in an edge
 * delta - defines in what part of the edge is the point,  is a normalized number from
 *   0 (start of the path) and 1 (end of the path). The position is interpolated.
 * offset - offset to add to the rendered point position.
 * renderer - renderer used to draw the shape at a given position.
 * speed - defines how fast the point is going to travel from the start to the end
 *  of the edge. It is a rate of the edge length, traveled by second. 1 means
 *  the edge is traveled in exactly 1 second. 0.5 is 2 seconds, 2 is half a second, etc.
 */
type TrafficPoint = {
  delta: number;
  offset: Point;
  renderer: TrafficPointRenderer;
  speed: number;
};

/**
 * TrafficPointGenerator generates the traffic animation points for
 * a single edge. There are two main use cases, solved in a similar way.
 * If the edge's points are uniform (all success or all error), then we generate
 * enough points to fill the edge, and let them animate in an infinite loop.
 * If it is a mix of success and error points, meaning we need to inject the
 * 'error-rate' percentage of error points, then we must generate enough points
 * such that when they iterate it looks roughly like a random injection of
 * error points. The smaller the percentage, the larger number of points
 * needed.
 *
 * launchTime - defines how fast to generate a new point, its in milliseconds.
 * speed      - defines the speed of the next point (see TrafficPoint.speed)
 */
export class TrafficPointGenerator {
  private errorRate: number = 0;
  private launchTime: number = 0;
  private speed: number = 0;
  private type: TrafficEdgeType = TrafficEdgeType.NONE;

  render(edge: Edge): React.ReactFragment {
    if (!this.launchTime || !this.speed) {
      return <></>;
    }

    const isUniform = this.errorRate < 0.01 || this.errorRate > 0.99;
    const points: Array<React.SVGProps<SVGElement>> = [];

    // time it takes for point to travel the edge
    const travelDuration = (1.0 / this.speed) * 1000;

    // how many points visible on edge at any given time, on average (i.e. this is a float)
    const pointsOnEdge = travelDuration / this.launchTime;

    // a slight randomization for the first point (0..500ms), so not everything launches at the same time
    const initialDelay = Math.random() * 500;

    if (isUniform) {
      // render a uniform set of trafficPoints, just enough to fill the edge

      // how many TrafficPoints we need to render (an int) on the edge. We need to render at
      // least one point for any edge with traffic, even if it is not always visible.
      const renderedPointsOnEdge = Math.ceil(pointsOnEdge);

      // time it takes for point to complete animation. This will be longer than then travel time
      // when numPoints on edge < 1.0
      const animationDuration = Math.max(travelDuration, this.launchTime);
      const animationDurationSeconds = `${animationDuration / 1000}s`;

      // the percentage of the animationDuration for which the TrafficPoint is visible
      const percentVisible = Math.min(100, Math.round((travelDuration / animationDuration) * 100));

      const renderer =
        this.type !== TrafficEdgeType.RPS
          ? getTrafficPointRendererForTcp(edge, animationDurationSeconds, percentVisible)
          : this.errorRate > 0
          ? getTrafficPointRendererForRpsError(edge, animationDurationSeconds, percentVisible)
          : getTrafficPointRendererForRpsSuccess(edge, animationDurationSeconds, percentVisible);

      const delayInterval = animationDuration / renderedPointsOnEdge;
      for (let i = 0; i < pointsOnEdge; ++i) {
        const animationDelay = `${i * delayInterval + initialDelay}ms`;
        const point = renderer.render(edge, animationDelay, undefined);
        points.unshift(point);
      }
    } else {
      // render traffic points with a percentage of errors

      // how many TrafficPoints we need to render (an int) on the edge. We need enough such that the
      // injected error points reflect the error rate, and seem relatively random despite the fact that
      // we are looping the animation. Unless visiblePoints is quite high, not all points will be visible.
      const visiblePointsOnEdge = Math.ceil(pointsOnEdge);
      const minPoints = Math.max(15, visiblePointsOnEdge); // for very high error rates
      const maxPoints = Math.max(50, visiblePointsOnEdge); // for very low error rates
      const renderedPointsOnEdge = minPoints + Math.round((1.0 - this.errorRate) * (maxPoints - minPoints));

      // time it takes for point to complete animation. This will be longer than then travel time
      // when visiblePoints < renderedPoints
      const animationDuration = Math.max(travelDuration, this.launchTime * renderedPointsOnEdge);
      const animationDurationSeconds = `${animationDuration / 1000}s`;

      // the percentage of the animationDuration for which the TrafficPoint is visible
      const percentVisible = Math.min(100, Math.round((travelDuration / animationDuration) * 100));

      const renderer = getTrafficPointRendererForRpsSuccess(edge, animationDurationSeconds, percentVisible);
      const errorRenderer = getTrafficPointRendererForRpsError(edge, animationDurationSeconds, percentVisible);

      const delayInterval = animationDuration / renderedPointsOnEdge;
      for (let i = 0, hasError = false; i < renderedPointsOnEdge; ++i) {
        const animationDelay = `${i * delayInterval + initialDelay}ms`;
        const isErrorPoint = Math.random() <= this.errorRate || (!hasError && i + 1 === renderedPointsOnEdge);
        const point = isErrorPoint
          ? errorRenderer.render(edge, animationDelay, undefined)
          : renderer.render(edge, animationDelay, undefined);
        points.unshift(point);
      }
    }

    return <>{points.map(p => p)}</>;
  }

  setTimer(timer: number | undefined) {
    this.launchTime = timer ?? 0;
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

  // getHash returns a string representing the combined animation settings, and can
  // be used to decide whether the animation settings have changed enough to
  // force a re-render of the animation. Because animation values are sensitive
  // and change frequently, we don't want to use them directly. We want to limit
  // re-renders to noticeable changes, and so we need this to return a different
  // value only on a significant shift in animation settings. To do this we:
  //   1) categorize an edge into a PFT EdgeAnimationSpeed bucket
  //   2) look for a sizeable change in error rate
  // and combine the values.
  getHash(edgeData: EdgeData) {
    let animationSpeedPF = EdgeAnimationSpeed.none;
    switch (edgeData.protocol) {
      case Protocol.GRPC:
        animationSpeedPF = timerConfig.computeAnimationSpeedPF(edgeData.grpc);
        break;
      case Protocol.HTTP:
        animationSpeedPF = timerConfig.computeAnimationSpeedPF(edgeData.http);
        break;
      case Protocol.TCP:
        animationSpeedPF = tcpTimerConfig.computeAnimationSpeedPF(edgeData.tcp);
        break;
    }
    return `${animationSpeedPF}:${this.errorRate.toFixed(1)}:${this.type}`;
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
 * - percentErr determines the percentage of TrafficPoints that should reflect errors.
 * - rate determines how many TrafficPoints should be traveling the edge at any given time.
 * - responseTime determines how fast TrafficPoints should travel from the start to the end of the edge.
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
    const settings = serverConfig.kialiFeatureFlags.uiDefaults.graph.settings;
    const edges = this.controller.getGraph().getEdges();

    // start our custom traffic animation
    if (settings.animation !== 'dash') {
      this.processEdges(edges);
      return;
    }

    // start default pft traffic animation
    tcpTimerConfig.resetCalibration();
    // Calibrate animation amplitude
    edges.forEach(e => {
      const edgeData = e.getData() as EdgeData;
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
    setObserved(() => {
      edges.forEach(e => {
        const edgeData = e.getData() as EdgeData;
        switch (edgeData.protocol) {
          case Protocol.GRPC:
            e.setEdgeAnimationSpeed(timerConfig.computeAnimationSpeedPF(edgeData.grpc));
            break;
          case Protocol.HTTP:
            e.setEdgeAnimationSpeed(timerConfig.computeAnimationSpeedPF(edgeData.http));
            break;
          case Protocol.TCP:
            e.setEdgeAnimationSpeed(tcpTimerConfig.computeAnimationSpeedPF(edgeData.tcp));
            break;
        }
        if (e.getEdgeAnimationSpeed() !== EdgeAnimationSpeed.none) {
          e.setEdgeStyle(EdgeStyle.dashedMd);
        }
      });
    });
  }

  /**
   * Stops the animation
   */
  stop() {
    const settings = serverConfig.kialiFeatureFlags.uiDefaults.graph.settings;
    const edges = this.controller.getGraph().getEdges();

    // stop our custom traffic animation
    if (settings.animation !== 'dash') {
      setObserved(() => {
        edges.forEach(e => e.setData({ ...e.getData(), animation: undefined }));
      });
      return;
    }

    // stop default pft traffic animation
    setObserved(() => {
      edges
        .filter(e => e.getEdgeAnimationSpeed() !== EdgeAnimationSpeed.none)
        .forEach(e => {
          e.setEdgeAnimationSpeed(EdgeAnimationSpeed.none);
          e.setEdgeStyle(EdgeStyle.solid);
        });
    });
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
          `error finding the edge length for traffic animation, not redering this TrafficEdge: ${error.message}`
        );
      }
    }

    const edgeData = edge.getData() as EdgeData;
    switch (trafficEdge.getType()) {
      case TrafficEdgeType.RPS: {
        const isHttp = edgeData.protocol === Protocol.HTTP;
        const rate = isHttp ? edgeData.http : edgeData.grpc;
        const pErr = isHttp ? edgeData.httpPercentErr : edgeData.grpcPercentErr;
        const timer = timerConfig.computeDelay(rate);
        // The edge length affects the speed, include a factor in the speed to even visual speed for long and short edges.
        const speed = this.speedFromResponseTime(edgeData.responseTime) * edgeLengthFactor;
        const errorRate = isNaN(pErr) ? 0 : pErr / 100;

        trafficEdge.setEdge(edge);
        trafficEdge.setErrorRate(errorRate);
        trafficEdge.setSpeed(speed);
        trafficEdge.setTimer(timer);
        break;
      }
      case TrafficEdgeType.TCP: {
        trafficEdge.setEdge(edge);
        trafficEdge.setErrorRate(0);
        trafficEdge.setSpeed(TCP_SPEED * edgeLengthFactor);
        trafficEdge.setTimer(tcpTimerConfig.computeDelay(edgeData.tcp));
        break;
      }
      default:
      // skip
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
