import * as React from 'react';
import { observer } from 'mobx-react';
import {
  WithContextMenuProps,
  WithDndDropProps,
  WithSelectionProps,
  WithDragNodeProps,
  BadgeLocation,
  CollapsibleGroupProps,
  LabelPosition,
  Node
} from '@patternfly/react-topology';
import { BaseGroupCollapsed } from './groupCollapsed';
import { BaseGroupExpanded } from './groupExpanded';

// This is a copy of PFT DefaultGroup (v4.68.3), then modified.  I don't see a better way to really
// do this because DefaultGroup embeds DefaultGroupCollapsed and DefaulGroupExpanded, but we need to
// add some customizations into those components (by also copying them).

type BaseGroupProps = {
  className?: string;
  element: Node;
  droppable?: boolean;
  canDrop?: boolean;
  dropTarget?: boolean;
  dragging?: boolean;
  dragRegroupable?: boolean;
  hover?: boolean;
  label?: string; // Defaults to element.getLabel()
  secondaryLabel?: string;
  showLabel?: boolean; // Defaults to true
  labelPosition?: LabelPosition; // Defaults to bottom
  truncateLength?: number; // Defaults to 13
  labelIconClass?: string; // Icon to show in label
  labelIcon?: string;
  labelIconPadding?: number;
  badge?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  badgeBorderColor?: string;
  badgeClassName?: string;
  badgeLocation?: BadgeLocation;
  // Customizations
  isFocused?: boolean;
  isUnhighlighted?: boolean;
} & Partial<CollapsibleGroupProps & WithSelectionProps & WithDndDropProps & WithDragNodeProps & WithContextMenuProps>;

const BaseGroupComponent: React.FunctionComponent<BaseGroupProps> = ({
  className,
  element,
  onCollapseChange,
  ...rest
}) => {
  const handleCollapse = (group: Node, collapsed: boolean): void => {
    if (collapsed && rest.collapsedWidth !== undefined && rest.collapsedHeight !== undefined) {
      group.setBounds(group.getBounds().setSize(rest.collapsedWidth, rest.collapsedHeight));
    }
    group.setCollapsed(collapsed);
    onCollapseChange && onCollapseChange(group, collapsed);
  };

  if (element.isCollapsed()) {
    return <BaseGroupCollapsed className={className} element={element} onCollapseChange={handleCollapse} {...rest} />;
  }
  return <BaseGroupExpanded className={className} element={element} onCollapseChange={handleCollapse} {...rest} />;
};

export const BaseGroup = observer(BaseGroupComponent);
