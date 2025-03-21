import { Edge } from '@patternfly/react-topology';
import * as React from 'react';

// AnimationEdge is a memo'd component that avoids a re-render unless edge position or rendering
// values have changed

type AnimationEdgeProps = {
  animationHash: string;
  edge: Edge;
  endX: number;
  endY: number;
  startX: number;
  startY: number;
};

const AnimationEdgeComponent: React.FC<AnimationEdgeProps> = (props: AnimationEdgeProps) => {
  const animation = props.edge.getData().animation;
  return animation ? <>{animation.render(props.edge)}</> : <></>;
};

export const AnimationEdge = React.memo(AnimationEdgeComponent);
