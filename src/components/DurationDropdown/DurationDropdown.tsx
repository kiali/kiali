import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';
import { Durations, serverConfig } from '../../config/ServerConfig';
import * as React from 'react';
import { DurationInSeconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { bindActionCreators } from 'redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { connect } from 'react-redux';

type BasicDurationDropdownProps = {
  duration: DurationInSeconds;
  disabled?: boolean;
  id?: string;
  setDuration: (duration: DurationInSeconds) => void;
  tooltip?: string;
};

// These are taken from the serverConfig
type ExtendedDurationDropdownProps = BasicDurationDropdownProps & {
  durations: Durations;
};

export class DurationDropdown extends React.Component<ExtendedDurationDropdownProps> {
  render() {
    return (
      <ToolbarDropdown
        id={this.props.id}
        disabled={this.props.disabled}
        handleSelect={key => this.props.setDuration(Number(key))}
        value={this.props.duration}
        label={this.props.durations[this.props.duration]}
        options={this.props.durations}
        tooltip={this.props.tooltip}
      />
    );
  }
}

export const DurationIntervalWithDurations = (props: BasicDurationDropdownProps) => {
  return <DurationDropdown durations={serverConfig.durations} {...props} />;
};

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setDuration: bindActionCreators(UserSettingsActions.setDuration, dispatch)
  };
};

const DurationDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(DurationIntervalWithDurations);

export default DurationDropdownContainer;
