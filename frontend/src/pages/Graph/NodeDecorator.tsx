import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import type { Node, TopologyQuadrant } from '@patternfly/react-topology';
import {
  DEFAULT_DECORATOR_RADIUS,
  Decorator,
  getDefaultShapeDecoratorCenter,
  observer
} from '@patternfly/react-topology';
import type { IconType } from 'config/Icons';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';

interface Props {
  element: Node;
  icon: IconType;
  quadrant: TopologyQuadrant;
  tooltip?: string;
}

const decoratorStyle = kialiStyle({
  color: PFColors.White,
  $nest: {
    '& .pf-topology__node__decorator__bg': {
      fill: PFColors.Purple40
    },
    '& .pf-topology__node__decorator__icon': {
      color: PFColors.White,
      $nest: {
        '& svg': {
          fill: PFColors.White
        }
      }
    }
  }
});

const NodeDecoratorInner: React.FC<Props> = ({ element, quadrant, icon, tooltip }) => {
  const { x, y } = getDefaultShapeDecoratorCenter(quadrant, element);
  const decoratorRef = React.useRef<SVGAElement | null>(null);

  return (
    <Tooltip triggerRef={decoratorRef} content={tooltip ?? icon.text}>
      <Decorator
        className={decoratorStyle}
        innerRef={decoratorRef}
        x={x}
        y={y}
        radius={DEFAULT_DECORATOR_RADIUS * 0.9}
        showBackground
        icon={React.createElement(icon.icon)}
      />
    </Tooltip>
  );
};

export const NodeDecorator = observer(NodeDecoratorInner);
