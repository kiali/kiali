import * as React from 'react';
import { connect } from 'react-redux';
import { DurationDropdown } from '../DurationDropdown/DurationDropdown';
import { Refresh } from 'components/Refresh/Refresh';
import { KialiAppState } from 'store/Store';
import { durationSelector, replayActiveSelector } from 'store/Selectors';
import { DurationInSeconds } from 'types/Common';
import { Tooltip, TooltipPosition, Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';
import { kialiStyle } from 'styles/StyleUtils';

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

const closeReplayStyle = kialiStyle({
  marginLeft: '1rem'
});

const TimeDurationComp: React.FC<TimeControlsProps> = (props: TimeControlsProps) => {
  const onToggleReplay = () => {
    props.toggleReplayActive();
  };

  const durationTooltip = props.replayActive ? 'Traffic metrics per frame' : 'Traffic metrics per refresh';
  let [prefix, suffix] = props.replayActive ? [undefined, 'Traffic'] : ['Last', undefined];

  return (
    <span>
      {props.supportsReplay && !props.replayActive && (
        <Tooltip key={'time_range_replay'} position={TooltipPosition.left} content="Replay...">
          <Button
            data-test="graph-replay-button"
            variant={ButtonVariant.link}
            style={{ padding: '0', marginRight: '10px' }}
            onClick={onToggleReplay}
          >
            <KialiIcon.History />
            <span style={{ marginLeft: '6px' }}>Replay</span>
          </Button>
        </Tooltip>
      )}
      <DurationDropdown
        id={'time_range_duration'}
        disabled={props.disabled}
        prefix={prefix}
        suffix={suffix}
        tooltip={durationTooltip}
        tooltipPosition={TooltipPosition.left}
      />
      {!(props.supportsReplay && props.replayActive) && (
        <Refresh id="time_range_refresh" disabled={props.disabled} hideLabel={true} manageURL={true} />
      )}
      {props.supportsReplay && props.replayActive && (
        <Button
          data-test="graph-replay-close-button"
          variant={ButtonVariant.link}
          className={closeReplayStyle}
          onClick={onToggleReplay}
          isInline
        >
          <span>
            <KialiIcon.Close />
            <span style={{ marginLeft: '5px' }}>Close Replay</span>
          </span>
        </Button>
      )}
    </span>
  );
};

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  replayActive: replayActiveSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  toggleReplayActive: bindActionCreators(UserSettingsActions.toggleReplayActive, dispatch)
});

export const TimeDurationComponent = connect(mapStateToProps, mapDispatchToProps)(TimeDurationComp);
