import * as React from 'react';
import { connect } from 'react-redux';
import { DurationDropdownContainer } from '../DurationDropdown/DurationDropdown';
import RefreshContainer from 'components/Refresh/Refresh';
import { KialiAppState } from 'store/Store';
import { durationSelector, replayActiveSelector } from 'store/Selectors';
import { DurationInSeconds } from 'types/Common';
import { Tooltip, TooltipPosition, Button } from '@patternfly/react-core';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from 'actions/KialiAppAction';
import { bindActionCreators } from 'redux';

type ReduxProps = {
  duration: DurationInSeconds;
  replayActive: boolean;

  toggleReplayActive: () => void;
};

type TimeRangeProps = ReduxProps & {
  disabled: boolean;
  id: string;
  supportsReplay?: boolean;

  handleRefresh: () => void;
};

export class TimeRange extends React.PureComponent<TimeRangeProps> {
  render() {
    const durationTooltip = this.props.replayActive ? 'Traffic metrics per frame' : 'Traffic metrics per refresh';

    return (
      <span>
        {this.props.supportsReplay && !this.props.replayActive && (
          <Tooltip key={'time_range_replay'} position={TooltipPosition.left} content="Replay...">
            <Button variant="link" style={{ padding: '1px 6px 0 0' }} onClick={this.onToggleReplay}>
              <KialiIcon.History className={defaultIconStyle} />
            </Button>
          </Tooltip>
        )}
        <DurationDropdownContainer
          id={'time_range_duration'}
          disabled={this.props.disabled}
          // prefix={durationPrefix}
          tooltip={durationTooltip}
        />
        {!(this.props.supportsReplay && this.props.replayActive) && (
          <RefreshContainer
            id="time_range_refresh"
            disabled={this.props.disabled}
            hideLabel={true}
            handleRefresh={this.props.handleRefresh}
            manageURL={true}
          />
        )}
        {this.props.supportsReplay && this.props.replayActive && (
          <Button variant="link" style={{ margin: '1px 0 0 5px' }} onClick={this.onToggleReplay}>
            <span>
              <KialiIcon.Close className={defaultIconStyle} />
              {`  Close Replay`}
            </span>
          </Button>
        )}
      </span>
    );
  }

  private onToggleReplay = () => {
    this.props.toggleReplayActive();
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  replayActive: replayActiveSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
});

const TimeRangeContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(TimeRange);

export default TimeRangeContainer;
