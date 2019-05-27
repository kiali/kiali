import * as React from 'react';
import { connect } from 'react-redux';
import { LoginActions } from '../actions/LoginActions';
import * as API from '../services/Api';
import { LoginSession } from '../store/Store';
import { KialiDispatch } from '../types/Redux';
import InitializingScreen from './InitializingScreen';
import authenticationConfig from '../config/AuthenticationConfig';

interface InitializerComponentProps {
  setInitialAuthentication: (session: LoginSession) => void;
  onInitializationFinished: () => void;
}

interface InitializerComponentState {
  errorMsg?: string;
  errorDetails?: string;
}

class InitializerComponent extends React.Component<InitializerComponentProps, InitializerComponentState> {
  constructor(props: InitializerComponentProps) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.fetchAuthenticationConfig();
  }

  render() {
    return <InitializingScreen errorMsg={this.state.errorMsg} errorDetails={this.state.errorDetails} />;
  }

  private fetchAuthenticationConfig = async () => {
    try {
      const authConfig = await API.getAuthInfo();
      authenticationConfig.authorizationEndpoint = authConfig.data.authorizationEndpoint;
      authenticationConfig.logoutEndpoint = authConfig.data.logoutEndpoint;
      authenticationConfig.logoutRedirect = authConfig.data.logoutRedirect;
      authenticationConfig.secretMissing = authConfig.data.secretMissing;
      authenticationConfig.strategy = authConfig.data.strategy;

      if (authConfig.data.sessionInfo.expiresOn && authConfig.data.sessionInfo.username) {
        this.props.setInitialAuthentication({
          username: authConfig.data.sessionInfo.username,
          expiresOn: authConfig.data.sessionInfo.expiresOn
        });
      }

      this.props.onInitializationFinished();
    } catch (err) {
      let errDetails: string | undefined;
      if (err.request) {
        const response = (err.request as XMLHttpRequest).responseText;
        if (response.trim().length > 0) {
          errDetails = response;
        }
      }

      this.setState({
        errorMsg: API.getErrorMsg('Initialization failed', err),
        errorDetails: errDetails
      });
    }
  };
}

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  setInitialAuthentication: (session: LoginSession) => dispatch(LoginActions.loginSuccess(session))
});

const StartupInitializer = connect(
  null,
  mapDispatchToProps
)(InitializerComponent);
export default StartupInitializer;
