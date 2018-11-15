import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import { KialiAppState } from '../store/Store';
import GraphRefresh from '../components/GraphFilter/GraphRefresh';
import { config } from '../config';
import { UserSettingsActions } from '../actions/UserSettingsActions';
import { durationSelector, refreshIntervalSelector } from '../store/Selectors';
import { DurationInSeconds } from '../types/Common';

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state),
  pollInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    onUpdatePollInterval: bindActionCreators(UserSettingsActions.setRefreshInterval, dispatch),
    onUpdateDuration: (duration: DurationInSeconds) => {
      dispatch(UserSettingsActions.setDuration(duration));
    }
  };
};

const pollIntervalDefaults = config().toolbar.pollInterval;

const GraphRefreshContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(GraphRefresh);

export const GraphRefreshContainerDefaultRefreshIntervals = props => {
  return <GraphRefreshContainer refreshIntervals={pollIntervalDefaults} {...props} />;
};
