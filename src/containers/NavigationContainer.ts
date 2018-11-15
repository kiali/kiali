import { connect } from 'react-redux';
import { KialiAppState, Component } from '../store/Store';
import Navigation from '../components/Nav/Navigation';
import { LoginThunkActions } from '../actions/LoginActions';
import { UserSettingsThunkActions } from '../actions/UserSettingsActions';

const getJaegerUrl = (components: Component[]) => {
  const jaegerinfo = components.find(comp => comp.name === 'Jaeger');
  return jaegerinfo ? jaegerinfo.url : '';
};

const mapStateToProps = (state: KialiAppState) => ({
  authenticated: state.authentication.logged,
  navCollapsed: state.userSettings.interface.navCollapse,
  jaegerUrl: getJaegerUrl(state.statusState.components)
});

const mapDispatchToProps = (dispatch: any) => ({
  checkCredentials: () => dispatch(LoginThunkActions.checkCredentials()),
  setNavCollapsed: (collapse: boolean) => dispatch(UserSettingsThunkActions.setNavCollapsed(!collapse))
});

const NavigationConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(Navigation);
export default NavigationConnected;
