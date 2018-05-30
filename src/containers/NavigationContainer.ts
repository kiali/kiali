import { KialiAppState } from '../store/Store';
import { connect } from 'react-redux';
import Navigation from '../components/Nav/Navigation';

const mapStateToProps = (state: KialiAppState) => ({
  authenticated: state.authentication.logged
});

const mapDispatchToProps = (dispatch: any) => ({});

const NavigationConnected = connect(mapStateToProps, mapDispatchToProps)(Navigation);
export default NavigationConnected;
