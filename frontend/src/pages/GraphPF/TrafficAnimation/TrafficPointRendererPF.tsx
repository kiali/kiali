import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { keyframes } from 'typestyle';
import { Edge } from '@patternfly/react-topology';

export abstract class TrafficPointRenderer {
  abstract render(
    element: Edge,
    animationDelay: string,
    repeat: boolean,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGElement>;
}

export class TrafficPointCircleRenderer extends TrafficPointRenderer {
  readonly animationDuration: string;
  readonly radius: number;
  readonly backgroundColor: string;
  readonly borderColor: string;
  private keyIndex = 0;

  constructor(animationDuration: string, radius: number, backgroundColor: string, borderColor: string) {
    super();
    this.animationDuration = animationDuration;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.radius = radius;
  }

  private getStyle(moveAnimation: string, repeat: boolean): string {
    return kialiStyle({
      fill: this.backgroundColor,
      stroke: this.borderColor,
      animationName: moveAnimation,
      animationDuration: this.animationDuration,
      animationFillMode: 'forwards',
      animationTimingFunction: 'linear',
      animationIterationCount: repeat ? 'infinite' : 1
    });
  }

  render(
    element: Edge,
    animationDelay: string,
    repeat: boolean,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGCircleElement> {
    const startPoint = element.getStartPoint();
    const endPoint = element.getEndPoint();

    const moveX = endPoint.x - startPoint.x;
    const moveY = endPoint.y - startPoint.y;

    const moveAnimation = keyframes({
      from: { transform: 'translateX(0)' },
      to: { transform: `translateX(${moveX}px) translateY(${moveY}px)`, display: repeat ? '' : 'none' }
    });

    if (onAnimationEnd) {
      console.log(`circle with callback`);
    }

    return (
      <circle
        key={`point-circle-${element.getId()}-${++this.keyIndex}`}
        cx={startPoint.x}
        cy={startPoint.y}
        r={`${this.radius}`}
        className={this.getStyle(moveAnimation, repeat)}
        style={{ animationDelay: animationDelay }}
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
  private keyIndex = 0;

  constructor(animationDuration: string, radius: number, backgroundColor: string, borderColor: string) {
    super();
    this.animationDuration = animationDuration;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.radius = radius;
  }

  private getStyle(moveAnimation: string, repeat: boolean): string {
    return kialiStyle({
      fill: this.backgroundColor,
      stroke: this.borderColor,
      strokeWidth: this.radius - 1,
      transformBox: 'fill-box',
      transformOrigin: 'center',
      rotate: '45deg',
      animationName: moveAnimation,
      animationDuration: this.animationDuration,
      animationFillMode: 'forwards',
      animationTimingFunction: 'linear',
      animationIterationCount: repeat ? 'infinite' : 1
    });
  }

  render(
    element: Edge,
    animationDelay: string,
    repeat: boolean,
    onAnimationEnd?: React.AnimationEventHandler
  ): React.SVGProps<SVGRectElement> {
    const startPoint = element.getStartPoint();
    const endPoint = element.getEndPoint();

    const moveX = endPoint.x - startPoint.x;
    const moveY = endPoint.y - startPoint.y;

    const moveAnimation = keyframes({
      from: { translate: '0' },
      to: { translate: `${moveX}px ${moveY}px`, display: repeat ? '' : 'none' }
    });

    if (onAnimationEnd) {
      console.log(`rect with callback`);
    }
    return (
      <rect
        key={`point-rect-${element.getId()}-${++this.keyIndex}`}
        className={this.getStyle(moveAnimation, repeat)}
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
