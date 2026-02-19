import * as React from 'react';
import { Popover, PopoverPosition } from '@patternfly/react-core';

type Props = {
  ariaLabel: string;
  bodyContent: React.ReactNode;
  headerContent: React.ReactElement;
  position?: PopoverPosition;
  showClose?: boolean;
  trigger: React.ReactElement;
  triggerAction?: 'click' | 'hover';
};

export const StatCountPopover: React.FC<Props> = (props: Props) => {
  return (
    <Popover
      aria-label={props.ariaLabel}
      position={props.position ?? PopoverPosition.right}
      triggerAction={props.triggerAction}
      showClose={props.showClose}
      headerContent={props.headerContent}
      bodyContent={props.bodyContent}
    >
      {props.trigger}
    </Popover>
  );
};
