import { ToolbarDropdown } from './ToolbarDropdown';
import { serverConfig, humanDurations } from '../../config/ServerConfig';
import * as React from 'react';
import { DurationInSeconds } from '../../types/Common';
import { KialiAppState } from '../../store/Store';
import { durationSelector } from '../../store/Selectors';
import { KialiDispatch } from 'types/Redux';
import { bindActionCreators } from 'redux';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { connect } from 'react-redux';
import { HistoryManager, URLParam, location } from '../../app/History';
import { TooltipPosition } from '@patternfly/react-core';
import { isKioskMode } from '../../utils/SearchParamUtils';
import { kioskDurationAction } from '../Kiosk/KioskActions';

type ReduxStateProps = {
  duration: DurationInSeconds;
};

type ReduxDispatchProps = {
  setDuration: (duration: DurationInSeconds) => void;
};

type DurationDropdownProps = ReduxStateProps &
  ReduxDispatchProps & {
    disabled?: boolean;
    id: string;
    nameDropdown?: string;
    prefix?: string;
    suffix?: string;
    tooltip?: string;
    tooltipPosition?: TooltipPosition;
  };

export const DurationDropdownComponent: React.FC<DurationDropdownProps> = (props: DurationDropdownProps) => {
  const updateDurationInterval = (duration: number): void => {
    props.setDuration(duration); // notify redux of the change

    if (isKioskMode()) {
      kioskDurationAction(duration);
    }
  };

  const durations = humanDurations(serverConfig, props.prefix, props.suffix);

  return (
    <ToolbarDropdown
      id={props.id}
      disabled={props.disabled}
      handleSelect={key => updateDurationInterval(Number(key))}
      value={String(props.duration)}
      label={durations[props.duration]}
      options={durations}
      tooltip={props.tooltip}
      tooltipPosition={props.tooltipPosition}
      nameDropdown={props.nameDropdown}
    />
  );
};

const withURLAwareness = (
  DurationDropdownComponent: React.FC<DurationDropdownProps>
): React.ComponentClass<DurationDropdownProps> => {
  return class extends React.Component<DurationDropdownProps> {
    constructor(props: DurationDropdownProps) {
      super(props);
      const urlParams = new URLSearchParams(location.getSearch());
      const urlDuration = HistoryManager.getDuration(urlParams);

      if (urlDuration !== undefined && urlDuration !== props.duration) {
        props.setDuration(urlDuration);
      }

      HistoryManager.setParam(URLParam.DURATION, String(props.duration));
    }

    componentDidUpdate(): void {
      HistoryManager.setParam(URLParam.DURATION, String(this.props.duration));
    }

    render(): React.ReactNode {
      return <DurationDropdownComponent {...this.props} />;
    }
  };
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  duration: durationSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    setDuration: bindActionCreators(UserSettingsActions.setDuration, dispatch)
  };
};

export const DurationDropdown = connect(
  mapStateToProps,
  mapDispatchToProps
)(withURLAwareness(DurationDropdownComponent));
