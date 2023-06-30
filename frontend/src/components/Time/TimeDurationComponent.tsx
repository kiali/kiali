import * as React from 'react';
import { connect } from 'react-redux';
import { DurationDropdown } from '../DurationDropdown/DurationDropdown';
import { Refresh } from 'components/Refresh/Refresh';
import { KialiAppState } from 'store/Store';
import { durationSelector, replayActiveSelector } from 'store/Selectors';
import { DurationInSeconds } from 'types/Common';
import { Tooltip, TooltipPosition, Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon, defaultIconStyle } from 'config/KialiIcon';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';

type ReduxProps = {
  duration: DurationInSeconds;
  replayActive: boolean;

  toggleReplayActive: () => void;
};

type TimeControlsProps = ReduxProps & {
  disabled: boolean;
  id: string;
  supportsReplay?: boolean;
};

class TimeDurationComp extends React.PureComponent<TimeControlsProps> {
  render() {
    const durationTooltip = this.props.replayActive ? 'Traffic metrics per frame' : 'Traffic metrics per refresh';
    let [prefix, suffix] = this.props.replayActive ? [undefined, 'Traffic'] : ['Last', undefined];

    return (
      <span>
        {this.props.supportsReplay && !this.props.replayActive && (
          <Tooltip key={'time_range_replay'} position={TooltipPosition.left} content="Replay...">
            <Button
              data-test="graph-replay-button"
              variant={ButtonVariant.link}
              style={{ padding: '1px 6px 0 0' }}
              onClick={this.onToggleReplay}
            >
              <KialiIcon.History className={defaultIconStyle} />
            </Button>
          </Tooltip>
        )}
        <DurationDropdown
          id={'time_range_duration'}
          disabled={this.props.disabled}
          prefix={prefix}
          suffix={suffix}
          tooltip={durationTooltip}
          tooltipPosition={TooltipPosition.left}
        />
        {!(this.props.supportsReplay && this.props.replayActive) && (
          <Refresh id="time_range_refresh" disabled={this.props.disabled} hideLabel={true} manageURL={true} />
        )}
        {this.props.supportsReplay && this.props.replayActive && (
          <Button
            data-test="graph-replay-close-button"
            variant={ButtonVariant.link}
            style={{ margin: '1px 0 0 5px' }}
            onClick={this.onToggleReplay}
          >
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

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
});

export const TimeDurationComponent = connect(mapStateToProps, mapDispatchToProps)(TimeDurationComp);
