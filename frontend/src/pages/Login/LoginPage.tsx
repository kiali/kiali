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

// Ensure dark background for login page.
const loginStyle = kialiStyle({
  backgroundColor: PFColors.Black1000,
  backgroundImage: 'none'
});

export class LoginPageComponent extends React.Component<LoginProps, LoginState> {
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
        const message = $t('HelperText.provideServiceAccountToken', 'Please, provide a Service Account token.');

        this.setState({
          showHelperText: true,
          errorInput: message,
          isValidToken: false,
          filledInputs: false
        });
      }
    }
  };
  renderMessage = (message: React.ReactNode | undefined, type: AlertVariant, key: string) => {
    if (!message) {
      return '';
    }
    const variant: AlertVariant =
      type ??
      (this.props.status === LoginStatus.error || this.state.filledInputs ? AlertVariant.danger : AlertVariant.warning);
    return <Alert key={key} variant={variant} isInline={true} isPlain={true} title={message} />;
  };

  extractOAuthErrorMessages = (urlParams: URLSearchParams, messagesArray: any[]) => {
    // When using OpenId auth, the IdP can redirect back with `error` and `error_description`
    // as url parameters. If these params are set, we cannot assume they are not spoofed, so we only
    // log the errors but do not show them in the UI. We only show a generic error message.
    // Reference: https://openid.net/specs/openid-connect-core-1_0-final.html#AuthError
    if (urlParams.get('error')) {
      if (urlParams.get('error_description')) {
        console.warn(`Authentication error_description: ${urlParams.get('error_description')}`);
        messagesArray.push(
          this.renderMessage($t('errorMsg.AuthFailed!', 'Authentication failed!'), AlertVariant.danger, 'idp-err')
        );
      } else {
        console.warn(`Authentication error: ${urlParams.get('error')}`);
        messagesArray.push(
          this.renderMessage($t('errorMsg.AuthFailed.', 'Authentication failed.'), AlertVariant.danger, 'idp-err')
        );
      }
    }
  };

  getHelperMessage = () => {
    const messages: any[] = [];
    if (this.state.showHelperText) {
      messages.push(this.renderMessage(this.state.errorInput, AlertVariant.custom, 'helperText'));
    }
    if (this.props.status === LoginStatus.expired) {
      messages.push(
        this.renderMessage(
          $t('HelperText.sessionExpiredOrTerminated', 'Your session has expired or was terminated in another window.'),
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

    // The implicit flow of OAuth/OpenId passes errors as hash parameters which aren't accessible
    // to the back-end. So, here we catch them and show error messages, if needed.
    const hashParamsString = window.location.hash;
    const hashParams = new URLSearchParams(hashParamsString.substring(1));
    this.extractOAuthErrorMessages(hashParams, messages);

    // Also, when using OpenId auth, the IdP can return with success. However, in the "authorization code" flow,
    // the Kiali backend still needs to do some extra negotiation with the IdP, which can fail.
    // The backend will set an "openid_error" url parameter when there is some failure.
    // Only log the openid_error since we cannot guarantee it is not spoofed. We only show a generic error message in the UI.
    if (urlParams.get('openid_error')) {
      console.warn(`Authentication openid_error: ${urlParams.get('openid_error')}`);
      messages.push(
        this.renderMessage(
          $t('errorMsg.OpenIDAuthFailed', 'OpenID authentication failed.'),
          AlertVariant.danger,
          'openid-err'
        )
      );
    }

    return messages;
  };

  render() {
    let loginLabel = $t('LogIn', 'Log In');
    if (authenticationConfig.strategy === AuthStrategy.openshift) {
      loginLabel = $t('LogInWithOpenShift', 'Log In With OpenShift');
    } else if (authenticationConfig.strategy === AuthStrategy.openid) {
      loginLabel = $t('LogInWithOpenID', 'Log In With OpenID');
    }

    const messages = this.getHelperMessage();
    const isLoggingIn = this.props.isPostLoginPerforming || this.props.status === LoginStatus.logging;
    const isLoginButtonDisabled = isLoggingIn || this.props.status === LoginStatus.loggedIn;
    let isHash = false;
    // Same conditions as in AuthenticationController
    if (isAuthStrategyOAuth()) {
      const pattern = /[#&](access_token|id_token)=/;
      isHash = pattern.test(window.location.hash);
    }

    if (
      (authenticationConfig.strategy === AuthStrategy.openshift ||
        authenticationConfig.strategy === AuthStrategy.openid) &&
      !isHash &&
      this.props.status === LoginStatus.loggedOut &&
      messages.length === 0 &&
      (this.props.message ?? '').length === 0
    ) {
      window.location.href = authenticationConfig.authorizationEndpoint!;
    }

    const listItem = (
      <>
        <ListItem>
          <LoginFooterItem href="https://www.kiali.io/">{$t('Documentation')}</LoginFooterItem>
        </ListItem>
        <ListItem>
          <LoginFooterItem href="https://github.com/kiali/kiali">{$t('Contribute')}</LoginFooterItem>
        </ListItem>
      </>
    );

    let loginPane: React.ReactFragment;
    if (authenticationConfig.strategy === AuthStrategy.token) {
      loginPane = (
        <Form data-test="login-form">
          <FormHelperText>{messages}</FormHelperText>
          <FormGroup fieldId="token" label={$t('Token')} isRequired={true}>
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
              {$t('LogIn')}
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
        textContent={$t('IstioServiceMeshMgr', 'Service mesh management for Istio.')}
        loginTitle={$t('LogInKiali', 'Log in Kiali')}
        className={loginStyle}
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

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  authenticate: (username: string, password: string) => dispatch(LoginThunkActions.authenticate(username, password))
});

export const LoginPage = connect(mapStateToProps, mapDispatchToProps)(LoginPageComponent);
