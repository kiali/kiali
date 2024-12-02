import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { keyframes } from 'typestyle';
import { Edge } from '@patternfly/react-topology';

export abstract class TrafficPointRenderer {
  abstract render(
    element: Edge,
    animationDelay: string,
    isInfinite: boolean,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGElement>;
}

function getMoveAnimation(edge: Edge, percentVisible: number, isInfinite: boolean): string {
  const startPoint = edge.getStartPoint();
  const endPoint = edge.getEndPoint();
  const moveAnimation = {};

  if (edge.getBendpoints().length === 0) {
    const moveX = endPoint.x - startPoint.x;
    const moveY = endPoint.y - startPoint.y;

    moveAnimation['0%'] = { opacity: 1, translate: '0' };
    moveAnimation[`${percentVisible}%`] = { opacity: 1, translate: `${moveX}px ${moveY}px`, display: isInfinite ? '' : 'none' };
    // this acts like a delay at the end, the animation continues but nothing is visible
    if (percentVisible < 100) {
      moveAnimation[`${percentVisible}.1%`] = { display: 'none' };
      moveAnimation['100%'] = { display: 'none' };
    }
  } else {
    // a kiali edge can have at most 1 bendpoint, in the middle. see extendedBaseEdge.ts
    const bendPoint = edge.getBendpoints()[0];
    const moveBendX = bendPoint.x - startPoint.x;
    const moveBendY = bendPoint.y - startPoint.y;
    const moveEndX = endPoint.x - startPoint.x;
    const moveEndY = endPoint.y - startPoint.y;
    const bend = Math.round(percentVisible / 2);

    moveAnimation['0%'] = { opacity: 1, translate: '0' };
    moveAnimation[`${bend}%`] = { opacity: 1, translate: `${moveBendX}px ${moveBendY}px` };
    moveAnimation[`${percentVisible}%`] = {
      translate: `${moveEndX}px ${moveEndY}px`,
      display: isInfinite ? '' : 'none'
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

  constructor(
    animationDuration: string,
    percentVisible: number,
    radius: number,
    backgroundColor: string,
    borderColor: string
  ) {
    super();
    this.animationDuration = animationDuration;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.percentVisible = percentVisible;
    this.radius = radius;
  }

  private getStyle(moveAnimation: string, isInfinite: boolean): string {
    return kialiStyle({
      opacity: 0,
      animationDuration: this.animationDuration,
      animationFillMode: 'forwards',
      animationIterationCount: isInfinite ? 'infinite' : 1,
      animationName: moveAnimation,
      animationTimingFunction: 'linear',
      fill: this.backgroundColor,
      stroke: this.borderColor
    });
  }

  render(
    edge: Edge,
    animationDelay: string,
    isInfinite: boolean,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGCircleElement> {
    const startPoint = edge.getStartPoint();
    const moveAnimation = getMoveAnimation(edge, this.percentVisible, isInfinite);

    // use random # to ensure the key is not repeat, or it can be ignored by the render
    const key = `point-circle-${Math.random()}`;
    return (
      <circle
        id={key}
        key={key}
        className={this.getStyle(moveAnimation, isInfinite)}
        style={{ animationDelay: animationDelay }}
        cx={startPoint.x}
        cy={startPoint.y}
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
    percentVisible: number,
    radius: number,
    backgroundColor: string,
    borderColor: string
  ) {
    super();
    this.animationDuration = animationDuration;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.percentVisible = percentVisible;
    this.radius = radius;
  }

  private getStyle(moveAnimation: string, isInfinite: boolean): string {
    return kialiStyle({
      opacity: 0,
      animationDuration: this.animationDuration,
      animationFillMode: 'forwards',
      animationIterationCount: isInfinite ? 'infinite' : 1,
      animationName: moveAnimation,
      animationTimingFunction: 'linear',
      fill: this.backgroundColor,
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
    isInfinite: boolean,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGRectElement> {
    const startPoint = edge.getStartPoint();
    const moveAnimation = getMoveAnimation(edge, this.percentVisible, isInfinite);

    // use random # to ensure the key is not repeated, or it can be ignored by the render
    const key = `point-rect-${Math.random()}}`;
    return (
      <rect
        id={key}
        key={key}
        className={this.getStyle(moveAnimation, isInfinite)}
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
