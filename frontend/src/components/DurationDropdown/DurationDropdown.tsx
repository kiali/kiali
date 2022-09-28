import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';
import { serverConfig, humanDurations } from '../../config/ServerConfig';
import * as React from 'react';
import { DurationInSeconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { connect } from 'react-redux';
import { HistoryManager, URLParam } from '../../app/History';
import history from '../../app/History';
import { TooltipPosition } from '@patternfly/react-core';
import { isKioskMode } from "../../utils/SearchParamUtils";
import { kioskDurationAction } from "../Kiosk/KioskActions";

type ReduxProps = {
  duration: DurationInSeconds;
  setDuration: (duration: DurationInSeconds) => void;
};

type DurationDropdownProps = ReduxProps & {
  id: string;
  disabled?: boolean;
  tooltip?: string;
  tooltipPosition?: TooltipPosition;
  menuAppendTo?: HTMLElement | (() => HTMLElement) | 'parent' | 'inline';
  nameDropdown?: string;
  suffix?: string;
  prefix?: string;
};

export class DurationDropdown extends React.Component<DurationDropdownProps> {

  render() {
    const durations = humanDurations(serverConfig, this.props.prefix, this.props.suffix);

    return (
      <ToolbarDropdown
        id={this.props.id}
        disabled={this.props.disabled}
        handleSelect={key => this.updateDurationInterval(Number(key))}
        value={String(this.props.duration)}
        label={durations[this.props.duration]}
        options={durations}
        tooltip={this.props.tooltip}
        tooltipPosition={this.props.tooltipPosition}
        nameDropdown={this.props.nameDropdown}
        menuAppendTo={this.props.menuAppendTo}
      />
    );
  }

  private updateDurationInterval = (duration: number) => {
    this.props.setDuration(duration); // notify redux of the change

    if (isKioskMode() ) {
      kioskDurationAction(duration);
    }
  };

}

const withDurations = DurationDropdownComponent => {
  return (props: DurationDropdownProps) => {
    return (
      <DurationDropdownComponent durations={humanDurations(serverConfig, props.prefix, props.suffix)} {...props} />
    );
  };
};

const withURLAwareness = DurationDropdownComponent => {
  return class extends React.Component<DurationDropdownProps> {
    constructor(props: DurationDropdownProps) {
      super(props);
      const urlParams = new URLSearchParams(history.location.search);
      const urlDuration = HistoryManager.getDuration(urlParams);
      if (urlDuration !== undefined && urlDuration !== props.duration) {
        props.setDuration(urlDuration);
      }
      HistoryManager.setParam(URLParam.DURATION, String(this.props.duration));
    }

    componentDidUpdate() {
      HistoryManager.setParam(URLParam.DURATION, String(this.props.duration));
    }

    render() {
      return <DurationDropdownComponent {...this.props} />;
    }
  };
};

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    setDuration: bindActionCreators(UserSettingsActions.setDuration, dispatch)
  };
};
export const DurationDropdownComponent = withDurations(DurationDropdown);

export const DurationDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(withURLAwareness(DurationDropdownComponent));
