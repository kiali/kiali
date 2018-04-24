import * as React from 'react';
import { DropdownButton, MenuItem } from 'patternfly-react';
import PropTypes from 'prop-types';

type ToolbarDropdownProps = {
  disabled: boolean;
  nameDropdown?: string;
  initialValue: number | string;
  initialLabel: string | undefined;
  onClick: PropTypes.func;
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
    this.setState({ currentValue: key[0], currentName: key[1] });
    this.props.onClick(key[0]);
  };

  render() {
    return (
      <div className="form-group">
        {this.props.nameDropdown && <label style={{ paddingRight: '0.5em' }}>{this.props.nameDropdown}:</label>}
        <DropdownButton title={this.state.currentName} onSelect={this.onKeyChanged}>
          {this.props.options.map(r => (
            <MenuItem key={r[0]} active={r[0] === this.state.currentValue} eventKey={r}>
              {r[1]}
            </MenuItem>
          ))}
        </DropdownButton>
      </div>
    );
  }
}
