import React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import {
  ActionGroup,
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
import { ExclamationCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import { KialiAppState, LoginSession, LoginStatus } from '../../store/Store';
import { AuthStrategy } from '../../types/Auth';
import { authenticationConfig, kialiLogo } from '../../config';
import { KialiAppAction } from '../../actions/KialiAppAction';
import LoginThunkActions from '../../actions/LoginThunkActions';
import { isAuthStrategyOAuth } from '../../config/AuthenticationConfig';
//import { c_wizard__nav_BoxShadow } from '@patternfly/react-tokens';

type LoginProps = {
  status: LoginStatus;
  session?: LoginSession;
  message?: string;
  error?: any;
  authenticate: (username: string, password: string) => void;
  isPostLoginPerforming: boolean;
  postLoginErrorMsg?: string;
};

type LoginState = {
  username: string;
  password: string;
  isValidUsername: boolean;
  isValidPassword: boolean;
  isValidToken: boolean;
  filledInputs: boolean;
  showHelperText: boolean;
  errorInput?: string;
};

export class LoginPage extends React.Component<LoginProps, LoginState> {
  static contextTypes = {
    store: () => null
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

  componentDidMount() {
    const loginInput = document.getElementById('pf-login-username-id');
    if (loginInput) {
      loginInput.focus();
    }
  }

  handlePasswordChange = passwordValue => {
    this.setState({ password: passwordValue });
  };

  handleSubmit = (e: any) => {
    e.preventDefault();

    if (isAuthStrategyOAuth()) {
      // If we are using OpenShift or OpenId strategy, take the user back to the authorization endpoint
      window.location.href = authenticationConfig.authorizationEndpoint!;
    } else if (authenticationConfig.strategy === AuthStrategy.header) {
      window.location.href = (window as any).WEB_ROOT ? (window as any).WEB_ROOT : '/';
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
  renderMessage = (message: React.ReactNode | undefined, type: string | undefined, key: string) => {
    if (!message) {
      return '';
    }
    const variant = type
      ? type
      : this.props.status === LoginStatus.error || this.state.filledInputs
      ? 'danger'
      : 'warning';
    const icon = variant === 'danger' ? <ExclamationCircleIcon /> : <ExclamationTriangleIcon />;
    return (
      <span key={key} style={{ color: variant === 'danger' ? '#c00' : '#f0ab00', fontWeight: 'bold', fontSize: 16 }}>
        {icon}
        &nbsp; {message}
      </span>
    );
  };

  getHelperMessage = () => {
    const messages: any[] = [];
    if (this.state.showHelperText) {
      messages.push(this.renderMessage(this.state.errorInput, undefined, 'helperText'));
    }
    if (this.props.status === LoginStatus.expired) {
      messages.push(
        this.renderMessage('Your session has expired or was terminated in another window.', 'warning', 'sessionExpired')
      );
    }
    if (this.props.status === LoginStatus.error) {
      messages.push(this.props.message);
    }
    if (this.props.postLoginErrorMsg) {
      messages.push(this.renderMessage(this.props.postLoginErrorMsg, undefined, 'postLoginError'));
    }

    // Get error messages passed on the URL
    const pageParams = window.location.search;
    const urlParams = new URLSearchParams(pageParams);

    // When using OpenId auth, the IdP can redirect back with `error` and `error_description`
    // as url parameters. If these params are set, show them as errors.
    // Reference: https://openid.net/specs/openid-connect-core-1_0-final.html#AuthError
    if (urlParams.get('error')) {
      if (urlParams.get('error_description')) {
        messages.push(
          this.renderMessage(`Authentication error: ${urlParams.get('error_description')}`, 'danger', 'idp-err')
        );
      } else {
        messages.push(
          this.renderMessage(
            `The OpenID provider returned the following error code: ${urlParams.get('error')}`,
            'danger',
            'idp-err'
          )
        );
      }
    }

    // Also, when using OpenId auth, the IdP can return with success. However, in the "authorization code" flow,
    // the Kiali backend still needs to do some extra negotiation with the IdP, which can fail.
    // The backend will set an "openid_error" url parameter when there is some failure.
    if (urlParams.get('openid_error')) {
      messages.push(
        this.renderMessage(`Authentication failed: ${urlParams.get('openid_error')}`, 'danger', 'openid-err')
      );
    }

    return messages;
  };

  render() {
    let loginLabel = 'Log In';
    if (authenticationConfig.strategy === AuthStrategy.openshift) {
      loginLabel = 'Log In With OpenShift';
    } else if (authenticationConfig.strategy === AuthStrategy.openid) {
      loginLabel = 'Log In With OpenID';
    }

    const messages = this.getHelperMessage();
    const isLoggingIn = this.props.isPostLoginPerforming || this.props.status === LoginStatus.logging;
    const isLoginButtonDisabled = isLoggingIn || this.props.status === LoginStatus.loggedIn;

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
        <Form>
          <FormHelperText
            isError={!this.state.isValidToken || this.props.status === LoginStatus.error}
            isHidden={!this.state.showHelperText && this.props.message === '' && messages.length === 0}
          >
            {messages}
          </FormHelperText>
          <FormGroup fieldId="token" label="Token" isRequired={true}>
            <TextInput id="token" type="password" onChange={this.handlePasswordChange} isRequired={true} />
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
        <Form>
          <FormHelperText
            isError={this.props.status === LoginStatus.error}
            isHidden={this.props.status !== LoginStatus.error && this.props.message === '' && messages.length === 0}
          >
            {messages}
          </FormHelperText>
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
        brandImgSrc={kialiLogo}
        brandImgAlt="Kiali logo"
        footerListItems={listItem}
        textContent="Service mesh management for Istio."
        loginTitle="Log in Kiali"
      >
        {loginPane}
      </LoginNext>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  status: state.authentication.status,
  message: state.authentication.message
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  authenticate: (username: string, password: string) => dispatch(LoginThunkActions.authenticate(username, password))
});

const LoginPageContainer = connect(mapStateToProps, mapDispatchToProps)(LoginPage);
export default LoginPageContainer;
