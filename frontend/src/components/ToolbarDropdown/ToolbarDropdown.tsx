import * as React from 'react';
import { Select, SelectOption, Text, TextVariants, Tooltip } from '@patternfly/react-core';
import { style } from 'typestyle';

const widthAuto = style({
  width: 'auto'
});

const spacingRight = style({
  marginRight: '10px',
  marginTop: '10px',
  display: 'inline'
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
  tooltipBottom?: boolean;
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
  isExpanded: boolean;
};

export class ToolbarDropdown extends React.Component<ToolbarDropdownProps, ToolbarDropdownState> {
  constructor(props: ToolbarDropdownProps) {
    super(props);
    this.state = {
      currentValue: props.value || props.initialValue,
      currentName: props.label || props.initialLabel,
      isExpanded: false
    };
  }

  onKeyChanged = (_, selection, isPlaceholder) => {
    if (!isPlaceholder) {
      this.setState({ currentValue: selection, currentName: this.props.options[selection] });
      const nameOrKey = this.props.useName ? this.props.options[selection] : selection;
      this.props.handleSelect(nameOrKey);
    }
    this.setState({ isExpanded: false });
  };

  onToggle = (isExpanded: boolean) => {
    this.setState({ isExpanded });
    this.props.onToggle && this.props.onToggle(isExpanded);
  };

  render() {
    const { isExpanded, currentName, currentValue } = this.state;
    const dropdownButton = (
      <Select
        onSelect={this.onKeyChanged}
        aria-label={this.props.id}
        selections={this.props.value || currentValue}
        placeholderText={this.props.label || currentName}
        id={this.props.id}
        toggleId={this.props.id + '-toggle'}
        onToggle={this.onToggle}
        isExpanded={isExpanded}
        ariaLabelledBy={this.props.id}
        isDisabled={this.props.disabled}
        className={this.props.classNameSelect ? `${this.props.classNameSelect} ${widthAuto}` : widthAuto}
      >
        {Object.keys(this.props.options).map(key => {
          return (
            <SelectOption
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
        {this.props.nameDropdown && (
          <Text component={TextVariants.h5} className={spacingRight}>
            {this.props.nameDropdown}
          </Text>
        )}
        {this.props.tooltip ? (
          <Tooltip
            key={'ot-' + this.props.id}
            entryDelay={1000}
            position={this.props.tooltipBottom ? 'bottom' : 'top'}
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
