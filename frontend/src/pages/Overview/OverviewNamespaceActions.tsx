import * as React from 'react';
import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  TooltipPosition
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { groupMenuStyle, kebabToggleStyle } from 'styles/DropdownStyles';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';
import { KialiIcon } from 'config/KialiIcon';

export type OverviewNamespaceAction = {
  action?: (namespace: string) => void;
  children?: OverviewNamespaceAction[];
  isDisabled?: boolean;
  isExternal?: boolean;
  isGroup: boolean;
  isSeparator: boolean;
  title?: string;
};

type Props = {
  actions: OverviewNamespaceAction[];
  namespace: string;
};

export const OverviewNamespaceActions: React.FC<Props> = (props: Props) => {
  const [isKebabOpen, setIsKebabOpen] = React.useState<boolean>(false);

  const onKebabToggle = (isOpen: boolean) => {
    setIsKebabOpen(isOpen);
  };

  const namespaceActions = props.actions.map((action, i) => {
    if (action.isSeparator) {
      return <Divider key={`separator_${i}`} />;
    }

    if (action.isGroup && action.children) {
      return (
        <DropdownGroup
          key={`group_${i}`}
          label={action.title}
          className={groupMenuStyle}
          children={action.children.map((subaction, j) => {
            const itemKey = `subaction_${i}_${j}`;

            const item = (
              <DropdownItem
                key={itemKey}
                isDisabled={subaction.isDisabled}
                onClick={() => (subaction.action ? subaction.action(props.namespace) : undefined)}
              >
                {subaction.title}
              </DropdownItem>
            );

            return subaction.isDisabled
              ? renderDisabledDropdownOption(
                  `tooltip_${itemKey}`,
                  TooltipPosition.left,
                  'User does not have enough permission for this action',
                  item
                )
              : item;
          })}
        />
      );
    } else if (action.title && action.action) {
      const item = (
        <DropdownItem
          key={`action_${i}`}
          isDisabled={action.isDisabled}
          data-test={action['data-test']}
          onClick={() => (action.action ? action.action(props.namespace) : undefined)}
        >
          {action.title} {!!action.isExternal ? <ExternalLinkAltIcon /> : undefined}
        </DropdownItem>
      );

      return action.isDisabled
        ? renderDisabledDropdownOption(
            `tooltip_action_${i}`,
            TooltipPosition.left,
            'User does not have enough permission for this action',
            item
          )
        : item;
    }

    return undefined;
  });

  return (
    <Dropdown
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          className={kebabToggleStyle}
          aria-label="Actions"
          variant="plain"
          onClick={() => onKebabToggle(!isKebabOpen)}
          isExpanded={isKebabOpen}
        >
          <KialiIcon.KebabToggle />
        </MenuToggle>
      )}
      isOpen={isKebabOpen}
      onOpenChange={(isOpen: boolean) => onKebabToggle(isOpen)}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>{namespaceActions}</DropdownList>
    </Dropdown>
  );
};
