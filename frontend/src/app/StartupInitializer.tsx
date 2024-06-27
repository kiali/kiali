import * as React from 'react';
import { connect } from 'react-redux';
import { LoginActions } from '../actions/LoginActions';
import * as API from '../services/Api';
import { LoginSession } from '../store/Store';
import { KialiDispatch } from '../types/Redux';
import { InitializingScreen } from './InitializingScreen';
import { authenticationConfig } from '../config/AuthenticationConfig';
import { isApiError } from 'types/Api';

interface ReduxProps {
  setInitialAuthentication: (session: LoginSession) => void;
}

type InitializerComponentProps = ReduxProps & {
  onInitializationFinished: () => void;
};

interface InitializerComponentState {
  errorDetails?: string;
  errorMsg?: string;
}

class InitializerComponent extends React.Component<InitializerComponentProps, InitializerComponentState> {
  constructor(props: InitializerComponentProps) {
    super(props);
    this.state = {};
  }

  componentDidMount(): void {
    this.fetchAuthenticationConfig();
  }

  render(): React.ReactNode {
    return <InitializingScreen errorMsg={this.state.errorMsg} errorDetails={this.state.errorDetails} />;
  }

  private fetchAuthenticationConfig = async (): Promise<void> => {
    try {
      const authConfig = await API.getAuthInfo();
      authenticationConfig.authorizationEndpoint = authConfig.data.authorizationEndpoint;
      authenticationConfig.authorizationEndpointPerCluster = authConfig.data.authorizationEndpointPerCluster;
      authenticationConfig.logoutEndpoint = authConfig.data.logoutEndpoint;
      authenticationConfig.logoutRedirect = authConfig.data.logoutRedirect;
      authenticationConfig.strategy = authConfig.data.strategy;

      if (authConfig.data.sessionInfo.expiresOn && authConfig.data.sessionInfo.username) {
        const intialInfo = {
          username: authConfig.data.sessionInfo.username,
          expiresOn: authConfig.data.sessionInfo.expiresOn
        };
        if (authConfig.data.sessionInfo.clusterInfo !== undefined) {
          intialInfo['clusterInfo'] = authConfig.data.sessionInfo.clusterInfo;
        }
        this.props.setInitialAuthentication(intialInfo);
      }

      this.props.onInitializationFinished();
    } catch (err) {
      if (isApiError(err)) {
        let errDetails: string | undefined;
        if (err.request) {
          const response = (err.request as XMLHttpRequest).responseText;
          if (response.trim().length > 0) {
            errDetails = response;
          }
        }

        this.setState({
          errorMsg: API.getErrorString(err),
          errorDetails: errDetails
        });
      }
    }
  };
}

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxProps => ({
  setInitialAuthentication: (session: LoginSession) => dispatch(LoginActions.loginSuccess(session))
});

export const StartupInitializer = connect(null, mapDispatchToProps)(InitializerComponent);
