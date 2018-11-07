import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import { KialiAppState } from '../store/Store';
import { UserSettingsActions } from '../actions/UserSettingsActions';
import { refreshIntervalSelector } from '../store/Selectors';
import Refresh from '../components/Refresh/Refresh';

const mapStateToProps = (state: KialiAppState) => ({
  selected: refreshIntervalSelector(state),
  pollInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return {
    onSelect: bindActionCreators(UserSettingsActions.setRefreshInterval, dispatch),
    onUpdatePollInterval: bindActionCreators(UserSettingsActions.setRefreshInterval, dispatch)
  };
};

const RefreshContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Refresh);

export default RefreshContainer;
