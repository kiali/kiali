import * as React from 'react';
import { DropdownButton, MenuItem } from 'patternfly-react';
import PropTypes from 'prop-types';

type DurationDropdownProps = {
  disabled: boolean;
  initialDuration: string;
  onClick: PropTypes.func;
};

type DurationDropdownState = {
  current: string;
};

export class DurationDropdown extends React.Component<DurationDropdownProps, DurationDropdownState> {
  static DurationIntervals = [
    ['60', '1 minute'],
    ['600', '10 minutes'],
    ['1800', '30 minutes'],
    ['3600', '1 hour'],
    ['14000', '4 hours'],
    ['28800', '8 hours'],
    ['86400', '1 day'],
    ['604800', '7 days'],
    ['2592000', '30 days']
  ];
  constructor(props: DurationDropdownProps) {
    super(props);
    this.state = {
      current: props.initialDuration
    };
  }

  onDurationChanged = (key: string) => {
    this.setState({ current: key });
    this.props.onClick(key);
  };

  render() {
    return (
      <DropdownButton id="duration" title="Duration" onSelect={this.onDurationChanged}>
        {DurationDropdown.DurationIntervals.map(r => (
          <MenuItem key={r[0]} active={r[0] === this.state.current} eventKey={r[0]}>
            {r[1]}
          </MenuItem>
        ))}
      </DropdownButton>
    );
  }
}
