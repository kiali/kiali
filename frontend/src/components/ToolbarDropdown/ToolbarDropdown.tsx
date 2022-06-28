import * as React from 'react';
import { Select, SelectOption, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { style } from 'typestyle';

const widthAuto = style({
  width: 'auto'
});

const dropdownTitle = style({
  fontSize: 'var(--pf-global--FontSize--md)',  // valueOf --pf-c-select__toggle--FontSize
  // @ts-ignore
  fontWeight: 'var(--pf-global--FontSize--normal)', // valueOf --pf-c-select__toggle--FontWeigt
  marginRight: '10px',
});

type ToolbarDropdownProps = {
  disabled?: boolean;
  id: string;
  initialLabel?: string;
  initialValue?: number | string;
  label?: string;
  nameDropdown?: string;
  options: object;
  tooltip?: string;
  tooltipPosition?: TooltipPosition;
  value?: number | string;
  useName?: boolean;
  classNameSelect?: string;
  classNameToolbar?: string;

  handleSelect: (value: string) => void;
  onToggle?: (isOpen: boolean) => void;
};

type ToolbarDropdownState = {
  currentValue?: number | string;
  currentName?: string;
  isOpen: boolean;
};

export class ToolbarDropdown extends React.Component<ToolbarDropdownProps, ToolbarDropdownState> {
  constructor(props: ToolbarDropdownProps) {
    super(props);
    this.state = {
      currentValue: props.value || props.initialValue,
      currentName: props.label || props.initialLabel,
      isOpen: false
    };
  }

  onKeyChanged = (_, selection, isPlaceholder) => {
    if (!isPlaceholder) {
      this.setState({ currentValue: selection, currentName: this.props.options[selection] });
      const nameOrKey = this.props.useName ? this.props.options[selection] : selection;
      this.props.handleSelect(nameOrKey);
    }
    this.setState({ isOpen: false });
  };

  onToggle = (isOpen: boolean) => {
    this.setState({ isOpen: isOpen });
    this.props.onToggle && this.props.onToggle(isOpen);
  };

  render() {
    const { isOpen, currentName, currentValue } = this.state;
    const dropdownButton = (
      <Select
        onSelect={this.onKeyChanged}
        aria-label={this.props.id}
        selections={this.props.value || currentValue}
        placeholderText={this.props.label || currentName}
        id={this.props.id}
        data-test={this.props.id}
        toggleId={this.props.id + '-toggle'}
        onToggle={this.onToggle}
        isOpen={isOpen}
        aria-labelledby={this.props.id}
        isDisabled={this.props.disabled}
        className={this.props.classNameSelect ? `${this.props.classNameSelect} ${widthAuto}` : widthAuto}
      >
        {Object.keys(this.props.options).map(key => {
          return (
            <SelectOption
              id={key}
              key={key}
              isDisabled={this.props.disabled}
              isSelected={key === String(this.props.value || this.state.currentValue)}
              value={`${key}`}
            >
              {this.props.options[key]}
            </SelectOption>
          );
        })}
      </Select>
    );
    return (
      <>
        {this.props.nameDropdown && <span className={dropdownTitle}>{this.props.nameDropdown}</span>}
        {this.props.tooltip ? (
          <Tooltip
            key={'ot-' + this.props.id}
            entryDelay={1000}
            position={this.props.tooltipPosition ? this.props.tooltipPosition : TooltipPosition.auto}
            content={<>{this.props.tooltip}</>}
          >
            {dropdownButton}
          </Tooltip>
        ) : (
          dropdownButton
        )}
      </>
    );
  }
}

export default ToolbarDropdown;
