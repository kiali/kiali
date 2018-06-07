import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import Navigation from '../components/Nav/Navigation';
import { LoginActions } from '../actions/LoginActions';

const mapStateToProps = (state: KialiAppState) => ({
  authenticated: state.authentication.logged
});

const mapDispatchToProps = (dispatch: any) => ({
  checkCredentials: () => dispatch(LoginActions.checkCredentials())
});

const NavigationConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(Navigation);
export default NavigationConnected;
