import * as React from 'react';
import { Divider, DropdownGroup, DropdownItem } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { groupMenuStyle } from 'styles/DropdownStyles';
import { NamespaceAction } from './NamespaceActions';

type Props = {
  actions: NamespaceAction[];
  namespace: string;
  onAction?: () => void;
};

export const NamespaceActionsDropdownGroup: React.FC<Props> = ({ actions, namespace, onAction }) => {
  if (actions.length === 0) {
    return null;
  }

  const items: React.ReactNode[] = [];

  actions.forEach((action, i) => {
    if (action.isSeparator) {
      items.push(<Divider key={`ns-sep-${i}`} />);
    } else if (action.isGroup && action.children) {
      items.push(
        <DropdownGroup key={`ns-group-${i}`} label={action.title} className={groupMenuStyle}>
          {action.children.map((child, j) => (
            <DropdownItem
              key={`ns-action-${i}-${j}`}
              isDisabled={child.isDisabled}
              onClick={() => {
                onAction?.();
                child.action?.(namespace);
              }}
            >
              {child.title} {child.isExternal && <ExternalLinkAltIcon />}
            </DropdownItem>
          ))}
        </DropdownGroup>
      );
    } else if (action.title && action.action) {
      items.push(
        <DropdownItem
          key={`ns-action-${i}`}
          isDisabled={action.isDisabled}
          onClick={() => {
            onAction?.();
            action.action!(namespace);
          }}
        >
          {action.title} {action.isExternal && <ExternalLinkAltIcon />}
        </DropdownItem>
      );
    }
  });

  return <>{items}</>;
};
