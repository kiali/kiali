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

export class TrafficPointCircleRenderer extends TrafficPointRenderer {
  readonly animationDuration: string;
  readonly radius: number;
  readonly backgroundColor: string;
  readonly borderColor: string;

  constructor(animationDuration: string, radius: number, backgroundColor: string, borderColor: string) {
    super();
    this.animationDuration = animationDuration;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.radius = radius;
  }

  private getStyle(moveAnimation: string, isInfinite: boolean): string {
    return kialiStyle({
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
    element: Edge,
    animationDelay: string,
    isInfinite: boolean,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGCircleElement> {
    const startPoint = element.getStartPoint();
    const endPoint = element.getEndPoint();

    const moveX = endPoint.x - startPoint.x;
    const moveY = endPoint.y - startPoint.y;

    const moveAnimation = keyframes({
      from: { transform: 'translateX(0)' },
      to: { transform: `translateX(${moveX}px) translateY(${moveY}px)`, display: isInfinite ? '' : 'none' }
    });

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
  readonly radius: number;
  readonly backgroundColor: string;
  readonly borderColor: string;

  constructor(animationDuration: string, radius: number, backgroundColor: string, borderColor: string) {
    super();
    this.animationDuration = animationDuration;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.radius = radius;
  }

  private getStyle(moveAnimation: string, isInfinite: boolean): string {
    return kialiStyle({
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
    element: Edge,
    animationDelay: string,
    isInfinite: boolean,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGRectElement> {
    const startPoint = element.getStartPoint();
    const endPoint = element.getEndPoint();

    const moveX = endPoint.x - startPoint.x;
    const moveY = endPoint.y - startPoint.y;

    const moveAnimation = keyframes({
      from: { translate: '0' },
      to: { translate: `${moveX}px ${moveY}px`, display: isInfinite ? '' : 'none' }
    });

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
