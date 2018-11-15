import { connect } from 'react-redux';
import { Dispatch } from 'redux';
import { KialiAppState } from '../store/Store';
import { UserSettingsActions } from '../actions/UserSettingsActions';
import { refreshIntervalSelector } from '../store/Selectors';
import Refresh from '../components/Refresh/Refresh';
import { PollIntervalInMs } from '../types/Common';

const mapStateToProps = (state: KialiAppState) => ({
  pollInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    setRefreshInterval: (refresh: PollIntervalInMs) => {
      dispatch(UserSettingsActions.setRefreshInterval(refresh));
    }
  };
};

const RefreshContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Refresh);

export default RefreshContainer;
