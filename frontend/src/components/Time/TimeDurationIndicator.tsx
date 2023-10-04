import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { Button, Tooltip } from '@patternfly/react-core';
import { config } from '../../config';
import { KialiIcon } from '../../config/KialiIcon';
import { DurationInSeconds, guardTimeRange, TimeRange } from '../../types/Common';
import { getName, getRefreshIntervalName } from '../../utils/RateIntervals';
import { KialiAppState } from '../../store/Store';
import { durationSelector, refreshIntervalSelector, timeRangeSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { history, HistoryManager } from '../../app/History';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';

interface Props {
  isDuration?: boolean;
  onClick?: () => void;
  setDuration: (duration: DurationInSeconds) => void;
  duration: DurationInSeconds;
  refreshInterval: number;
  timeRange: TimeRange;
}

const infoStyle = kialiStyle({
  margin: '0px 5px 2px 5px'
});

class TimeDurationIndicatorComponent extends React.PureComponent<Props> {
  constructor(props: Props) {
    super(props);

    // This is needed to initialise the component using the parameters in the URL.
    // If we don't set the state, we lost the value if we click in other tabs and go back
    const urlParams = new URLSearchParams(history.location.search);
    const urlDuration = HistoryManager.getDuration(urlParams);

    if (urlDuration !== undefined && urlDuration !== props.duration) {
      props.setDuration(urlDuration);
    }
  }

  timeDurationIndicator() {
    if (this.props.isDuration) {
      return getName(this.props.duration);
    } else {
      return guardTimeRange(this.props.timeRange, getName, () => '(custom)');
    }
  }

  timeDurationDetailLabel() {
    return this.props.isDuration ? 'Current duration' : 'Current time range';
  }

  timeDurationDetail() {
    if (this.props.isDuration) {
      return `Last ${getName(this.props.duration)}`;
    } else {
      return guardTimeRange(
        this.props.timeRange,
        d => `Last ${getName(d)}`,
        b => new Date(b.from!).toLocaleString() + ' to ' + (b.to ? new Date(b.to).toLocaleString() : 'now')
      );
    }
  }

  render() {
    return (
      <Tooltip
        isContentLeftAligned={true}
        maxWidth={'50em'}
        content={
          <>
            <p>Select the time range of shown data, and the refresh interval.</p>
            <p style={{ whiteSpace: 'nowrap' }}>
              {this.timeDurationDetailLabel()}: {this.timeDurationDetail()}
              <br />
              Current refresh interval: {config.toolbar.refreshInterval[this.props.refreshInterval]}
            </p>
          </>
        }
      >
        <Button variant="link" isInline={true} onClick={this.props.onClick}>
          <KialiIcon.Clock className={infoStyle} />
          {this.timeDurationIndicator()}, {getRefreshIntervalName(this.props.refreshInterval)}
        </Button>
      </Tooltip>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  timeRange: timeRangeSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    setDuration: bindActionCreators(UserSettingsActions.setDuration, dispatch)
  };
};

export const TimeDurationIndicator = connect(mapStateToProps, mapDispatchToProps)(TimeDurationIndicatorComponent);
