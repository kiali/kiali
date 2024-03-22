import * as React from 'react';
import {
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { useTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from 'types/Common';

const dropdownTitle = kialiStyle({
  alignSelf: 'center',
  marginRight: '10px'
});

type ToolbarDropdownProps = {
  className?: string;
  disabled?: boolean;
  handleSelect: (value: string) => void;
  id: string;
  label: string;
  nameDropdown?: string;
  onToggle?: (isOpen: boolean) => void;
  options: object;
  tooltip?: string;
  tooltipPosition?: TooltipPosition;
  value?: number | string;
};

export const ToolbarDropdown: React.FC<ToolbarDropdownProps> = (props: ToolbarDropdownProps) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const { t } = useTranslation(I18N_NAMESPACE);

  const onKeyChanged = (_event?: React.MouseEvent<Element, MouseEvent>, selection?: string | number): void => {
    if (selection) {
      props.handleSelect(String(selection));
    }

    setIsOpen(false);
  };

  const onToggleClick = (): void => {
    setIsOpen(!isOpen);
    props.onToggle && props.onToggle(isOpen);
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>): React.ReactNode => (
    <MenuToggle
      id={`${props.id}-toggle`}
      ref={toggleRef}
      onClick={onToggleClick}
      isExpanded={isOpen}
      isDisabled={props.disabled}
      className={props.className}
    >
      {t(props.label)}
    </MenuToggle>
  );

  const dropdownButton = (
    <Select
      toggle={toggle}
      onSelect={onKeyChanged}
      aria-label={props.id}
      selected={props.value}
      id={props.id}
      data-test={props.id}
      onOpenChange={isOpen => setIsOpen(isOpen)}
      isOpen={isOpen}
      aria-labelledby={props.id}
    >
      <SelectList>
        {Object.keys(props.options).map(key => {
          return (
            <SelectOption
              id={key}
              key={key}
              isDisabled={props.disabled}
              isSelected={key === String(props.value)}
              value={`${key}`}
            >
              {t(props.options[key])}
            </SelectOption>
          );
        })}
      </SelectList>
    </Select>
  );

  return (
    <>
      {props.nameDropdown && <span className={dropdownTitle}>{props.nameDropdown}</span>}
      {props.tooltip ? (
        <Tooltip
          key={`ot-${props.id}`}
          entryDelay={1000}
          position={props.tooltipPosition ? props.tooltipPosition : TooltipPosition.auto}
          content={<>{props.tooltip}</>}
        >
          {dropdownButton}
        </Tooltip>
      ) : (
        dropdownButton
      )}
    </>
  );
};
