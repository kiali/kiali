import { Tooltip } from '@patternfly/react-core';
import { DEFAULT_DECORATOR_RADIUS, Decorator, Node, TopologyQuadrant, getDefaultShapeDecoratorCenter, observer } from '@patternfly/react-topology';
import { IconType } from 'config/Icons';
import React from 'react';

interface Props {
  element: Node,
  quadrant: TopologyQuadrant,
  icon: IconType,
  tooltip?: string
}

const NodeDecoratorInner: React.FC<Props> = ({element, quadrant, icon, tooltip}) => {
  const { x, y } = getDefaultShapeDecoratorCenter(quadrant, element);
  const decoratorRef = React.useRef<SVGAElement | null>(null);

  return (
    <Tooltip triggerRef={decoratorRef} content={!!tooltip ? tooltip : icon.text}>
      <Decorator innerRef={decoratorRef} x={x} y={y} radius={DEFAULT_DECORATOR_RADIUS} showBackground icon={React.createElement(icon.icon)} />
    </Tooltip>
  );
};

export const NodeDecorator = observer(NodeDecoratorInner);
