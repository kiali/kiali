import { connect } from 'react-redux';
import { KialiAppState } from '../store/Store';
import { UserSettingsActions } from '../actions/UserSettingsActions';
import { refreshIntervalSelector } from '../store/Selectors';
import Refresh from '../components/Refresh/Refresh';
import { PollIntervalInMs } from '../types/Common';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../actions/KialiAppAction';

const mapStateToProps = (state: KialiAppState) => ({
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
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
