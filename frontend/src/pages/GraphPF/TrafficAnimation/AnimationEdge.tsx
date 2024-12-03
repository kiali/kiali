import { Edge } from '@patternfly/react-topology';
import * as React from 'react';

// AnimationEdge is a memo'd component that avoids a re-render unless the edge points change
// or an animationTime expires (meaning we need to generate new trafficpoints).

type AnimationEdgeProps = {
  animationTime?: number;
  edge: Edge;
  endX: number;
  endY: number;
  startX: number;
  startY: number;
};

const AnimationEdgeComponent: React.FC<AnimationEdgeProps> = (props: AnimationEdgeProps) => {
  return <>{props.edge.getData().animation.render(props.edge)}</>;
};

export const AnimationEdge = React.memo(AnimationEdgeComponent);
