import * as React from 'react';
import MetricsOptionsBar from '../../components/MetricsOptions/MetricsOptionsBar';
import { DropdownButton, MenuItem } from 'patternfly-react';

type RateIntervalToolbarItemProps = {
  rateIntervalSelected: string;
  onRateIntervalChanged?: (key: string) => void;
};

export default class RateIntervalToolbarItem extends React.Component<RateIntervalToolbarItemProps> {
  render() {
    const rateIntervalSelected = MetricsOptionsBar.RateIntervals.find(el => {
      return el[0] === this.props.rateIntervalSelected;
    });

    return (
      <div className="form-group">
        <label style={{ paddingRight: '0.5em' }}>Rate Interval:</label>
        <DropdownButton
          title={'Last ' + rateIntervalSelected![1]}
          onSelect={this.props.onRateIntervalChanged}
          id="rateIntervalDropDown"
        >
          {MetricsOptionsBar.RateIntervals.map(r => (
            <MenuItem key={r[0]} active={r[0] === this.props.rateIntervalSelected} eventKey={r[0]}>
              Last {r[1]}
            </MenuItem>
          ))}
        </DropdownButton>
      </div>
    );
  }
}
