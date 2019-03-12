import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import Navigation from '../components/Nav/Navigation';
import { KialiAppState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import UserSettingsThunkActions from '../actions/UserSettingsThunkActions';

const mapStateToProps = (state: KialiAppState) => ({
  navCollapsed: state.userSettings.interface.navCollapse,
  jaegerUrl: state.jaegerState.jaegerURL,
  jaegerIntegration: state.jaegerState.enableIntegration
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setNavCollapsed: (collapse: boolean) => dispatch(UserSettingsThunkActions.setNavCollapsed(!collapse))
});

const NavigationContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(Navigation);
export default NavigationContainer;
