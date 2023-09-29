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

const dropdownTitle = kialiStyle({
  marginRight: '10px',
  alignSelf: 'center'
});

type ToolbarDropdownProps = {
  className?: string;
  disabled?: boolean;
  id: string;
  label?: string;
  nameDropdown?: string;
  options: object;
  tooltip?: string;
  tooltipPosition?: TooltipPosition;
  value?: number | string;

  handleSelect: (value: string) => void;
  onToggle?: (isOpen: boolean) => void;
};

export const ToolbarDropdown: React.FC<ToolbarDropdownProps> = (props: ToolbarDropdownProps) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);

  const onKeyChanged = (_event?: React.MouseEvent<Element, MouseEvent>, selection?: string | number) => {
    if (selection) {
      props.handleSelect(String(selection));
    }

    setIsOpen(false);
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
    props.onToggle && props.onToggle(isOpen);
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      id={`${props.id}-toggle`}
      ref={toggleRef}
      onClick={onToggleClick}
      isExpanded={isOpen}
      isDisabled={props.disabled}
      className={props.className}
    >
      {props.label}
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
              {props.options[key]}
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
          key={'ot-' + props.id}
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
