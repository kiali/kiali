import * as React from 'react';
import { DropdownButton, MenuItem } from 'patternfly-react';
import * as RateIntervals from '../../utils/RateIntervals';

type RateIntervalToolbarItemProps = {
  rateIntervalSelected: number;
  onRateIntervalChanged?: (key: number) => void;
};

export default class RateIntervalToolbarItem extends React.Component<RateIntervalToolbarItemProps> {
  render() {
    const rateIntervalName = RateIntervals.getName(this.props.rateIntervalSelected);

    return (
      <div className="form-group">
        <label style={{ paddingRight: '0.5em' }}>Rate Interval:</label>
        <DropdownButton title={rateIntervalName} onSelect={this.props.onRateIntervalChanged} id="rateIntervalDropDown">
          {RateIntervals.tuples.map(r => (
            <MenuItem key={r[0]} active={r[0] === this.props.rateIntervalSelected} eventKey={r[0]}>
              {r[1]}
            </MenuItem>
          ))}
        </DropdownButton>
      </div>
    );
  }
}
