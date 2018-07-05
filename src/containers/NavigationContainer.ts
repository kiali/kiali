import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import Navigation from '../components/Nav/Navigation';
import { LoginActions } from '../actions/LoginActions';
import { UserSettingsActions } from '../actions/UserSettingsActions';

const mapStateToProps = (state: KialiAppState) => ({
  authenticated: state.authentication.logged,
  navCollapsed: state.userSettings.interface.navCollapse
});

const mapDispatchToProps = (dispatch: any) => ({
  checkCredentials: () => dispatch(LoginActions.checkCredentials()),
  setNavCollapsed: (collapse: boolean) => dispatch(UserSettingsActions.setNavCollapsed(!collapse))
});

const NavigationConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(Navigation);
export default NavigationConnected;
