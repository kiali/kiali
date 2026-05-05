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
import { useKialiTranslation } from 'utils/I18nUtils';
import { renderDisabledDropdownOption } from 'utils/DropdownUtils';
import { KialiIcon } from 'config/KialiIcon';

export type NamespaceAction = {
  action?: (namespace: string) => void;
  children?: NamespaceAction[];
  isDisabled?: boolean;
  isExternal?: boolean;
  isGroup: boolean;
  isSeparator: boolean;
  title?: string;
};

type Props = {
  actions: NamespaceAction[];
  namespace: string;
  /** Plain "Actions" button (detail page); default is kebab for list rows */
  toggleVariant?: 'actionsText' | 'kebab';
};

export const NamespaceActions: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();
  const [isKebabOpen, setIsKebabOpen] = React.useState<boolean>(false);
  const variant = props.toggleVariant ?? 'kebab';

  const onKebabToggle = (isOpen: boolean): void => {
    setIsKebabOpen(isOpen);
  };

  const onKebabSelect = (): void => {
    setIsKebabOpen(!isKebabOpen);
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
                  t('No user permission or Kiali in view-only mode'),
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
            t('No user permission or Kiali in view-only mode'),
            item
          )
        : item;
    }

    return undefined;
  });

  const isDetailActions = variant === 'actionsText';

  return (
    <Dropdown
      data-test={isDetailActions ? 'namespace-actions-dropdown' : undefined}
      id={isDetailActions ? 'actions' : undefined}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          className={variant === 'kebab' ? kebabToggleStyle : undefined}
          aria-label={variant === 'kebab' ? 'Actions' : undefined}
          data-test={isDetailActions ? 'namespace-actions-toggle' : undefined}
          id={isDetailActions ? 'actions-toggle' : undefined}
          variant={variant === 'kebab' ? 'plain' : undefined}
          onClick={() => onKebabToggle(!isKebabOpen)}
          isExpanded={isKebabOpen}
        >
          {variant === 'kebab' ? <KialiIcon.KebabToggle /> : t('Actions')}
        </MenuToggle>
      )}
      isOpen={isKebabOpen}
      onOpenChange={(isOpen: boolean) => onKebabToggle(isOpen)}
      onSelect={onKebabSelect}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>{namespaceActions}</DropdownList>
    </Dropdown>
  );
};
