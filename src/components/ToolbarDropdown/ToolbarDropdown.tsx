import * as React from 'react';
import { DropdownButton, MenuItem, OverlayTrigger, Tooltip } from 'patternfly-react';

type ToolbarDropdownProps = {
  disabled?: boolean;
  id?: string;
  initialLabel?: string;
  initialValue?: number | string;
  label?: string;
  nameDropdown?: string;
  options: object;
  tooltip?: string;
  value?: number | string;
  useName?: boolean;

  handleSelect: (value: string) => void;
  onToggle?: (isOpen: boolean) => void;
};

type ToolbarDropdownState = {
  currentValue?: number | string;
  currentName?: string;
};

export class ToolbarDropdown extends React.Component<ToolbarDropdownProps, ToolbarDropdownState> {
  constructor(props: ToolbarDropdownProps) {
    super(props);
    this.state = {
      currentValue: props.value || props.initialValue,
      currentName: props.label || props.initialLabel
    };
  }

  onKeyChanged = (key: any) => {
    this.setState({ currentValue: key, currentName: this.props.options[key] });
    const nameOrKey = this.props.useName ? this.props.options[key] : key;
    this.props.handleSelect(nameOrKey);
  };

  render() {
    const dropdownButton = (
      <DropdownButton
        disabled={this.props.disabled}
        title={this.props.label || this.state.currentName}
        onSelect={this.onKeyChanged}
        id={this.props.id}
        onToggle={(isOpen: boolean) => this.props.onToggle && this.props.onToggle(isOpen)}
      >
        {Object.keys(this.props.options).map(key => (
          <MenuItem key={key} active={key === (this.props.value || this.state.currentValue)} eventKey={key}>
            {this.props.options[key]}
          </MenuItem>
        ))}
      </DropdownButton>
    );
    return (
      <>
        {this.props.nameDropdown && <label style={{ paddingRight: '0.5em' }}>{this.props.nameDropdown}</label>}
        {this.props.tooltip ? (
          <OverlayTrigger
            key={'ot-' + this.props.id}
            placement="top"
            trigger={['hover', 'focus']}
            delayShow={1000}
            overlay={<Tooltip id={'tt-' + this.props.id}>{this.props.tooltip}</Tooltip>}
          >
            {dropdownButton}
          </OverlayTrigger>
        ) : (
          dropdownButton
        )}
      </>
    );
  }
}

export default ToolbarDropdown;
