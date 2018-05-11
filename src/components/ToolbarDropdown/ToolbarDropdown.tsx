import * as React from 'react';
import { DropdownButton, MenuItem } from 'patternfly-react';
import PropTypes from 'prop-types';

type ToolbarDropdownProps = {
  disabled: boolean;
  id?: string;
  nameDropdown?: string;
  initialValue: number | string;
  initialLabel: string | undefined;
  handleSelect: PropTypes.func;
  options: PropTypes.Map<string | number, string>;
};

type ToolbarDropdownState = {
  currentValue: number | string;
  currentName: string | undefined;
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
    this.props.handleSelect(key);
  };

  render() {
    return (
      <div className="form-group">
        {this.props.nameDropdown && <label style={{ paddingRight: '0.5em' }}>{this.props.nameDropdown}:</label>}
        <DropdownButton title={this.state.currentName} onSelect={this.onKeyChanged} id={this.props.id}>
          {Object.keys(this.props.options).map(key => (
            <MenuItem key={key} active={key === this.state.currentValue} eventKey={key}>
              {this.props.options[key]}
            </MenuItem>
          ))}
        </DropdownButton>
      </div>
    );
  }
}

export default ToolbarDropdown;
