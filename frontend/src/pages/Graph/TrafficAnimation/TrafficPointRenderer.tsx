import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { keyframes } from 'typestyle';
import { Edge } from '@patternfly/react-topology';

export abstract class TrafficPointRenderer {
  abstract render(
    edge: Edge,
    animationDelay: string,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGElement>;
}

// Cache for edge points to avoid repeated getStartPoint/getEndPoint calls
// These can trigger expensive getPointAtLength calculations
const edgePointsCache = new WeakMap<Edge, { bendpoints: any[]; end: any; start: any; timestamp: number }>();
const EDGE_POINTS_CACHE_TTL = 100; // 100ms cache

function getCachedEdgePoints(edge: Edge): { bendpoints: any[]; end: any; start: any } {
  const now = performance.now();
  const cached = edgePointsCache.get(edge);

  if (cached && now - cached.timestamp < EDGE_POINTS_CACHE_TTL) {
    return { bendpoints: cached.bendpoints, end: cached.end, start: cached.start };
  }

  const start = edge.getStartPoint();
  const end = edge.getEndPoint();
  const bendpoints = edge.getBendpoints();
  const result = { bendpoints, end, start };
  edgePointsCache.set(edge, { ...result, timestamp: now });

  return result;
}

function getMoveAnimation(edge: Edge, percentVisible: number): string {
  const { bendpoints, end: endPoint, start: startPoint } = getCachedEdgePoints(edge);
  const moveAnimation = {};

  if (bendpoints.length === 0) {
    const moveX = endPoint.x - startPoint.x;
    const moveY = endPoint.y - startPoint.y;

    moveAnimation['0%'] = { opacity: 1, translate: '0' };
    moveAnimation[`${percentVisible}%`] = {
      opacity: 1,
      translate: `${moveX}px ${moveY}px`
    };
    // this acts like a delay at the end, the animation continues but nothing is visible
    if (percentVisible < 100) {
      moveAnimation[`${percentVisible}.1%`] = { display: 'none' };
      moveAnimation['100%'] = { display: 'none' };
    }
  } else {
    // a kiali edge can have at most 1 bendpoint, in the middle. see extendedBaseEdge.ts
    const bendPoint = bendpoints[0];
    const moveBendX = bendPoint.x - startPoint.x;
    const moveBendY = bendPoint.y - startPoint.y;
    const moveEndX = endPoint.x - startPoint.x;
    const moveEndY = endPoint.y - startPoint.y;
    const bend = Math.round(percentVisible / 2);

    moveAnimation['0%'] = { opacity: 1, translate: '0' };
    moveAnimation[`${bend}%`] = { opacity: 1, translate: `${moveBendX}px ${moveBendY}px` };
    moveAnimation[`${percentVisible}%`] = {
      translate: `${moveEndX}px ${moveEndY}px`
    };
    // this acts like a delay at the end, the animation continues but nothing is visible
    if (percentVisible < 100) {
      moveAnimation[`${percentVisible}.1%`] = { display: 'none' };
      moveAnimation['100%'] = { display: 'none' };
    }
  }
  return keyframes(moveAnimation);
}

export class TrafficPointCircleRenderer extends TrafficPointRenderer {
  readonly animationDuration: string;
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly percentVisible: number;
  readonly radius: number;
  readonly withOffsets: boolean;

  constructor(
    animationDuration: string,
    backgroundColor: string,
    borderColor: string,
    percentVisible: number,
    radius: number,
    withOffsets: boolean
  ) {
    super();
    this.animationDuration = animationDuration;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.percentVisible = percentVisible;
    this.radius = radius;
    this.withOffsets = withOffsets;
  }

  private getStyle(moveAnimation: string): string {
    return kialiStyle({
      animationDuration: this.animationDuration,
      animationFillMode: 'forwards',
      animationIterationCount: 'infinite',
      animationName: moveAnimation,
      animationTimingFunction: 'linear',
      fill: this.backgroundColor,
      opacity: 0,
      stroke: this.borderColor
    });
  }

  render(
    edge: Edge,
    animationDelay: string,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGCircleElement> {
    const { start: startPoint } = getCachedEdgePoints(edge);
    const moveAnimation = getMoveAnimation(edge, this.percentVisible);
    // If requested, calculate offsets. The offset must be small to avoid more serious
    // calculation that would ensure perpendicular distance from the edge. Instead, we
    // just apply a [-2.5, 2.5] offset to both 'x' and 'y'
    const offsetX = this.withOffsets ? Math.random() * 5 - 2.5 : 0;
    const offsetY = this.withOffsets ? Math.random() * 5 - 2.5 : 0;

    // use random # to ensure the key is not repeat, or it can be ignored by the render
    const key = `point-circle-${Math.random()}`;
    return (
      <circle
        id={key}
        key={key}
        className={this.getStyle(moveAnimation)}
        style={{ animationDelay: animationDelay }}
        cx={startPoint.x + offsetX}
        cy={startPoint.y + offsetY}
        r={`${this.radius}`}
        onAnimationEnd={onAnimationEnd}
      />
    );
  }
}

export class TrafficPointDiamondRenderer extends TrafficPointRenderer {
  readonly animationDuration: string;
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly percentVisible: number;
  readonly radius: number;

  constructor(
    animationDuration: string,
    backgroundColor: string,
    borderColor: string,
    percentVisible: number,
    radius: number
  ) {
    super();
    this.animationDuration = animationDuration;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.percentVisible = percentVisible;
    this.radius = radius;
  }

  private getStyle(moveAnimation: string): string {
    return kialiStyle({
      animationDuration: this.animationDuration,
      animationFillMode: 'forwards',
      animationIterationCount: 'infinite',
      animationName: moveAnimation,
      animationTimingFunction: 'linear',
      fill: this.backgroundColor,
      opacity: 0,
      rotate: '45deg',
      stroke: this.borderColor,
      strokeWidth: this.radius - 1,
      transformBox: 'fill-box',
      transformOrigin: 'center'
    });
  }

  render(
    edge: Edge,
    animationDelay: string,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGRectElement> {
    const { start: startPoint } = getCachedEdgePoints(edge);
    const moveAnimation = getMoveAnimation(edge, this.percentVisible);

    // use random # to ensure the key is not repeated, or it can be ignored by the render
    const key = `point-rect-${Math.random()}}`;
    return (
      <rect
        id={key}
        key={key}
        className={this.getStyle(moveAnimation)}
        style={{ animationDelay: animationDelay }}
        x={startPoint.x - this.radius}
        y={startPoint.y - this.radius}
        width={this.radius * 2 - 1}
        height={this.radius * 2 - 1}
        onAnimationEnd={onAnimationEnd}
      />
    );
  }
}
