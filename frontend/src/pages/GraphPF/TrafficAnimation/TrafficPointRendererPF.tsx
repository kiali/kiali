import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { keyframes } from 'typestyle';
import { Edge } from '@patternfly/react-topology';

export abstract class TrafficPointRenderer {
  abstract render(element: Edge, animationDelay: string): React.SVGProps<SVGElement>;
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

  private getStyle(move: string): string {
    return kialiStyle({
      fill: this.backgroundColor,
      stroke: this.borderColor,
      animationName: move,
      animationDuration: this.animationDuration,
      animationFillMode: 'forwards',
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite'
    });
  }

  render(element: Edge, animationDelay: string): React.SVGProps<SVGCircleElement> {
    const startPoint = element.getStartPoint();
    const endPoint = element.getEndPoint();

    const moveX = endPoint.x - startPoint.x;
    const moveY = endPoint.y - startPoint.y;

    const move = keyframes({
      from: { transform: 'translateX(0)' },
      to: { transform: `translateX(${moveX}px) translateY(${moveY}px)` }
    });

    return (
      <circle
        cx={startPoint.x}
        cy={startPoint.y}
        r={`${this.radius}`}
        className={this.getStyle(move)}
        style={{ animationDelay: animationDelay }}
      />
    );
  }

  /*
    context.fillStyle = this.backgroundColor;
    context.strokeStyle = this.borderColor;
    context.lineWidth = this.lineWidth;
    context.beginPath();
    context.arc(point.x, point.y, this.radius, 0, 2 * Math.PI, true);
    context.stroke();
    context.fill();
    */
}

/*
export class TrafficPointConcentricDiamondRenderer extends TrafficPointRenderer {
  readonly outerDiamond: Diamond;
  readonly innerDiamond: Diamond;

  private static diamondPath(context: any, point: Point, diamond: Diamond) {
    context.fillStyle = diamond.backgroundColor;
    context.strokeStyle = diamond.borderColor;
    context.lineWidth = diamond.lineWidth;
    context.beginPath();
    context.moveTo(point.x, point.y - diamond.radius);
    context.lineTo(point.x + diamond.radius, point.y);
    context.lineTo(point.x, point.y + diamond.radius);
    context.lineTo(point.x - diamond.radius, point.y);
    context.lineTo(point.x, point.y - diamond.radius);
    context.stroke();
    context.fill();
  }

  constructor(outerDiamond: Diamond, innerDiamond: Diamond) {
    super();
    this.outerDiamond = outerDiamond;
    this.innerDiamond = innerDiamond;
  }

  render(point: Point) {
    TrafficPointConcentricDiamondRenderer.diamondPath(point, this.outerDiamond);
    TrafficPointConcentricDiamondRenderer.diamondPath(point, this.innerDiamond);
  }
}

export class Diamond {
  radius: number;
  backgroundColor: string;
  borderColor: string;
  lineWidth: number;

  constructor(radius: number, backgroundColor: string, borderColor: string, lineWidth: number) {
    this.radius = radius;
    this.backgroundColor = backgroundColor;
    this.borderColor = borderColor;
    this.lineWidth = lineWidth;
  }
}

*/
