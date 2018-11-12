import { connect } from 'react-redux';
import { KialiAppState } from '../store/Store';
import { UserSettingsActions } from '../actions/UserSettingsActions';
import { durationSelector } from '../store/Selectors';
import MetricsOptionsBar, { MetricsOptionsBarProps } from '../components/MetricsOptions/MetricsOptionsBar';
import { Dispatch } from 'redux';
import { DurationInSeconds } from '../types/Common';
import { Omit, RouteComponentProps, withRouter } from 'react-router';

type MetricsOptionsBarContainerProps = Omit<MetricsOptionsBarProps, 'duration' | 'setDuration'>;

const mapStateToProps = (state: KialiAppState) => ({
  duration: durationSelector(state)
});

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setDuration: (duration: DurationInSeconds) => {
      dispatch(UserSettingsActions.setDuration(duration));
    }
  };
};

const MetricsOptionBarContainer = withRouter<RouteComponentProps<{}> & MetricsOptionsBarContainerProps>(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )(MetricsOptionsBar)
);

export default MetricsOptionBarContainer;
