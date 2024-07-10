import React from 'react';
import { connect } from 'react-redux';
import {
  ActionGroup,
  Alert,
  AlertVariant,
  Button,
  ButtonVariant,
  Form,
  FormGroup,
  FormHelperText,
  ListItem,
  ListVariant,
  LoginFooterItem,
  LoginPage as LoginNext,
  TextInput
} from '@patternfly/react-core';
import { KialiAppState, LoginSession, LoginStatus } from '../../store/Store';
import { AuthStrategy } from '../../types/Auth';
import { authenticationConfig, kialiLogoDark } from '../../config';
import { LoginThunkActions } from '../../actions/LoginThunkActions';
import { isAuthStrategyOAuth } from '../../config/AuthenticationConfig';
import { KialiDispatch } from '../../types/Redux';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { webRoot } from 'app/History';

interface ReduxProps {
  message: string;
  status: LoginStatus;
}

type ReduxDispatchProps = {
  authenticate: (username: string, password: string) => void;
};

type LoginProps = ReduxProps &
  ReduxDispatchProps & {
    error?: any;
    isPostLoginPerforming: boolean;
    postLoginErrorMsg?: string;
    session?: LoginSession;
  };

type LoginState = {
  errorInput?: string;
  filledInputs: boolean;
  isValidPassword: boolean;
  isValidToken: boolean;
  isValidUsername: boolean;
  password: string;
  showHelperText: boolean;
  username: string;
};

// Ensure dark background for login page.
const loginStyle = kialiStyle({
  backgroundColor: PFColors.Black1000,
  backgroundImage: 'none'
});

export class LoginPageComponent extends React.Component<LoginProps, LoginState> {
  static contextTypes = {
    store: (): null => null
  };

  constructor(props: LoginProps) {
    super(props);

    this.state = {
      username: '',
      password: '',
      isValidUsername: true,
      isValidPassword: true,
      isValidToken: true,
      filledInputs: false,
      showHelperText: false,
      errorInput: ''
    };
  }

  componentDidMount(): void {
    const loginInput = document.getElementById('pf-login-username-id');
    if (loginInput) {
      loginInput.focus();
    }
  }

  handlePasswordChange = (passwordValue: string): void => {
    this.setState({ password: passwordValue });
  };

  handleSubmit = (e: any): void => {
    e.preventDefault();

    if (isAuthStrategyOAuth()) {
      // If we are using OpenShift or OpenId strategy, take the user back to the authorization endpoint
      window.location.href = authenticationConfig.authorizationEndpoint!;
    } else if (authenticationConfig.strategy === AuthStrategy.header) {
      window.location.href = webRoot;
    } else if (authenticationConfig.strategy === AuthStrategy.token) {
      if (this.state.password.trim().length !== 0 && this.props.authenticate) {
        this.props.authenticate('', this.state.password);
        this.setState({
          showHelperText: false,
          errorInput: '',
          isValidToken: true,
          filledInputs: true
        });
      } else {
        const message = 'Please, provide a Service Account token.';

        this.setState({
          showHelperText: true,
          errorInput: message,
          isValidToken: false,
          filledInputs: false
        });
      }
    }
  };

  renderMessage = (message: React.ReactNode | undefined, type: AlertVariant, key: string): JSX.Element | string => {
    if (!message) {
      return '';
    }
    const variant: AlertVariant =
      type ??
      (this.props.status === LoginStatus.error || this.state.filledInputs ? AlertVariant.danger : AlertVariant.warning);
    return <Alert key={key} variant={variant} isInline={true} isPlain={true} title={message} />;
  };

  extractOAuthErrorMessages = (urlParams: URLSearchParams, messagesArray: any[]): void => {
    // When using OpenId auth, the IdP can redirect back with `error` and `error_description`
    // as url parameters. If these params are set, we cannot assume they are not spoofed, so we only
    // log the errors but do not show them in the UI. We only show a generic error message.
    // Reference: https://openid.net/specs/openid-connect-core-1_0-final.html#AuthError
    if (urlParams.get('error')) {
      if (urlParams.get('error_description')) {
        console.warn(`Authentication error_description: ${urlParams.get('error_description')}`);
        messagesArray.push(this.renderMessage(`Authentication failed!`, AlertVariant.danger, 'idp-err'));
      } else {
        console.warn(`Authentication error: ${urlParams.get('error')}`);
        messagesArray.push(this.renderMessage(`Authentication failed.`, AlertVariant.danger, 'idp-err'));
      }
    }
  };

  getHelperMessage = (): any[] => {
    const messages: any[] = [];
    if (this.state.showHelperText) {
      messages.push(this.renderMessage(this.state.errorInput, AlertVariant.custom, 'helperText'));
    }
    if (this.props.status === LoginStatus.expired) {
      messages.push(
        this.renderMessage(
          'Your session has expired or was terminated in another window.',
          AlertVariant.warning,
          'sessionExpired'
        )
      );
    }
    if (this.props.status === LoginStatus.error) {
      messages.push(this.props.message);
    }
    if (this.props.postLoginErrorMsg) {
      messages.push(this.renderMessage(this.props.postLoginErrorMsg, AlertVariant.custom, 'postLoginError'));
    }

    // Get error messages passed on the URL (authorization code flow of OAuth/OpenId)
    const pageParams = window.location.search;
    const urlParams = new URLSearchParams(pageParams);
    this.extractOAuthErrorMessages(urlParams, messages);

    // Also, when using OpenId auth, the IdP can return with success. However, in the "authorization code" flow,
    // the Kiali backend still needs to do some extra negotiation with the IdP, which can fail.
    // The backend will set an "openid_error" url parameter when there is some failure.
    // Only log the openid_error since we cannot guarantee it is not spoofed. We only show a generic error message in the UI.
    if (urlParams.get('openid_error')) {
      console.warn(`Authentication openid_error: ${urlParams.get('openid_error')}`);
      messages.push(this.renderMessage(`OpenID authentication failed.`, AlertVariant.danger, 'openid-err'));
    } else if (urlParams.get('openshift_error')) {
      console.warn(`Authentication openshift_error: ${urlParams.get('openshift_error')}`);
      messages.push(this.renderMessage(`Openshift authentication failed.`, AlertVariant.danger, 'openshift-err'));
    }

    return messages;
  };

  render(): JSX.Element {
    let loginLabel = 'Log In';
    if (authenticationConfig.strategy === AuthStrategy.openshift) {
      loginLabel = 'Log In With OpenShift';
    } else if (authenticationConfig.strategy === AuthStrategy.openid) {
      loginLabel = 'Log In With OpenID';
    }

    const messages = this.getHelperMessage();
    const isLoggingIn = this.props.isPostLoginPerforming || this.props.status === LoginStatus.logging;
    const isLoginButtonDisabled = isLoggingIn || this.props.status === LoginStatus.loggedIn;
    // Same conditions as in AuthenticationController

    if (
      (authenticationConfig.strategy === AuthStrategy.openshift ||
        authenticationConfig.strategy === AuthStrategy.openid) &&
      this.props.status === LoginStatus.loggedOut &&
      messages.length === 0 &&
      (this.props.message ?? '').length === 0
    ) {
      window.location.href = authenticationConfig.authorizationEndpoint!;
    }

    const listItem = (
      <>
        <ListItem>
          <LoginFooterItem href="https://www.kiali.io/">Documentation</LoginFooterItem>
        </ListItem>
        <ListItem>
          <LoginFooterItem href="https://github.com/kiali/kiali">Contribute</LoginFooterItem>
        </ListItem>
      </>
    );

    let loginPane: React.ReactFragment;
    if (authenticationConfig.strategy === AuthStrategy.token) {
      loginPane = (
        <Form data-test="login-form">
          <FormHelperText>{messages}</FormHelperText>
          <FormGroup fieldId="token" label="Token" isRequired={true}>
            <TextInput
              id="token"
              type="password"
              onChange={(_event, passwordValue) => this.handlePasswordChange(passwordValue)}
              isRequired={true}
            />
          </FormGroup>
          <ActionGroup>
            <Button
              type="submit"
              onClick={this.handleSubmit}
              isDisabled={isLoginButtonDisabled}
              style={{ width: '100%' }}
              variant={ButtonVariant.primary}
            >
              Log In
            </Button>
          </ActionGroup>
        </Form>
      );
    } else {
      loginPane = (
        <Form data-test="login-form">
          <FormHelperText>{messages}</FormHelperText>
          <ActionGroup>
            <Button type="submit" onClick={this.handleSubmit} style={{ width: '100%' }} variant={ButtonVariant.primary}>
              {loginLabel}
            </Button>
          </ActionGroup>
        </Form>
      );
    }

    return (
      <LoginNext
        footerListVariants={ListVariant.inline}
        brandImgSrc={kialiLogoDark}
        brandImgAlt="Kiali logo"
        footerListItems={listItem}
        textContent="Service mesh management for Istio."
        loginTitle="Log in Kiali"
        className={loginStyle}
      >
        {loginPane}
      </LoginNext>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  status: state.authentication.status,
  message: state.authentication.message
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  authenticate: (username: string, password: string) => dispatch(LoginThunkActions.authenticate(username, password))
});

export const LoginPage = connect(mapStateToProps, mapDispatchToProps)(LoginPageComponent);
