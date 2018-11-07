import { connect } from 'react-redux';
import { KialiAppState } from '../store/Store';
import { UserSettingsActions } from '../actions/UserSettingsActions';
import { durationIntervalSelector } from '../store/Selectors';
import MetricsOptionsBar from '../components/MetricsOptions/MetricsOptionsBar';
import { Duration } from '../types/GraphFilter';
import { Dispatch } from 'redux';

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setDuration: (duration: Duration) => {
      dispatch(UserSettingsActions.setDurationInterval(duration.value));
    }
  };
};

const MetricsOptionBarContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(MetricsOptionsBar);

export default MetricsOptionBarContainer;
