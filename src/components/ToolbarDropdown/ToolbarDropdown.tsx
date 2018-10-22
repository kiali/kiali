import * as React from 'react';
import { DropdownButton, MenuItem } from 'patternfly-react';

type ToolbarDropdownProps = {
  disabled?: boolean;
  useName?: boolean;
  id?: string;
  nameDropdown?: string;
  value?: number | string;
  initialValue?: number | string;
  label?: string;
  initialLabel?: string;
  handleSelect: Function;
  options: { [key: string]: string };
};

type ToolbarDropdownState = {
  currentValue?: number | string;
  currentName?: string;
};

export class ToolbarDropdown extends React.Component<ToolbarDropdownProps, ToolbarDropdownState> {
  constructor(props: ToolbarDropdownProps) {
    super(props);
    this.state = {
      currentValue: props.initialValue,
      currentName: props.initialLabel
    };
  }

  onKeyChanged = (key: any) => {
    this.setState({ currentValue: key, currentName: this.props.options[key] });
    const nameOrKey = this.props.useName ? this.props.options[key] : key;
    this.props.handleSelect(nameOrKey);
  };

  render() {
    return (
      <>
        {this.props.nameDropdown && (
          <label style={{ paddingRight: '0.5em', paddingLeft: '0.5em' }}>{this.props.nameDropdown}</label>
        )}
        <DropdownButton
          disabled={this.props.disabled}
          title={this.props.label || this.state.currentName}
          onSelect={this.onKeyChanged}
          id={this.props.id}
        >
          {Object.keys(this.props.options).map(key => (
            <MenuItem key={key} active={key === (this.props.value || this.state.currentValue)} eventKey={key}>
              {this.props.options[key]}
            </MenuItem>
          ))}
        </DropdownButton>
      </>
    );
  }
}

export default ToolbarDropdown;
