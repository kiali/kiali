import React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import {
  ActionGroup,
  Button,
  Form,
  FormGroup,
  FormHelperText,
  ListItem,
  ListVariant,
  LoginFooterItem,
  LoginForm,
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

  handleUsernameChange = value => {
    this.setState({ username: value });
  };

  handlePasswordChange = passwordValue => {
    this.setState({ password: passwordValue });
  };

  handleSubmit = (e: any) => {
    e.preventDefault();

    if (isAuthStrategyOAuth()) {
      // If we are using OpenShift or OpenId strategy, take the user back to the authorization endpoint
      window.location.href = authenticationConfig.authorizationEndpoint!;
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
    } else {
      this.setState({
        isValidUsername: !!this.state.username,
        isValidPassword: !!this.state.password,
        filledInputs: !!this.state.username && !!this.state.password
      });

      if (!!this.state.username && !!this.state.password && this.props.authenticate) {
        this.props.authenticate(this.state.username, this.state.password);
        this.setState({ showHelperText: false, errorInput: '' });
      } else {
        let message = 'Invalid login credentials.';
        message +=
          !!!this.state.username && !!!this.state.password
            ? 'Username and password are required.'
            : !!this.state.username
            ? 'Password is required.'
            : 'Username is required.';

        this.setState({
          showHelperText: true,
          errorInput: message,
          isValidUsername: false,
          isValidPassword: false
        });
      }
    }
  };
  renderMessage = (message: string | undefined, type?: string) => {
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
      <span
        key={message}
        style={{ color: variant === 'danger' ? '#c00' : '#f0ab00', fontWeight: 'bold', fontSize: 16 }}
      >
        {icon}
        &nbsp; {message}
      </span>
    );
  };

  getHelperMessage = () => {
    const messages: any[] = [];
    if (this.state.showHelperText) {
      messages.push(this.renderMessage(this.state.errorInput));
    }
    if (authenticationConfig.secretMissing) {
      messages.push(
        this.renderMessage(
          `The Kiali secret is missing. Users are prohibited from accessing Kiali until an administrator
          creates a valid secret. Please refer to the Kiali documentation for more details.`,
          'danger'
        )
      );
    }
    if (this.props.status === LoginStatus.expired) {
      messages.push(this.renderMessage('Your session has expired or was terminated in another window.', 'warning'));
    }
    if (!authenticationConfig.secretMissing && this.props.status === LoginStatus.error) {
      messages.push(this.props.message);
    }
    if (this.props.postLoginErrorMsg) {
      messages.push(this.renderMessage(this.props.postLoginErrorMsg));
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
    const isLoginButtonDisabled =
      isLoggingIn || (this.props.postLoginErrorMsg !== undefined && this.props.postLoginErrorMsg.length !== 0);

    const loginForm = (
      <LoginForm
        usernameLabel="Username"
        showHelperText={this.state.showHelperText || this.props.message !== '' || messages.length > 0}
        helperText={<>{messages}</>}
        usernameValue={this.state.username}
        onChangeUsername={this.handleUsernameChange}
        isValidUsername={this.state.isValidUsername && this.props.status !== LoginStatus.error}
        passwordLabel="Password"
        passwordValue={this.state.password}
        onChangePassword={this.handlePasswordChange}
        isValidPassword={this.state.isValidPassword && this.props.status !== LoginStatus.error}
        rememberMeAriaLabel="Remember me Checkbox"
        onLoginButtonClick={(e: any) => this.handleSubmit(e)}
        style={{ marginTop: '10px' }}
        loginButtonLabel={isLoggingIn ? 'Logging in...' : undefined}
        isLoginButtonDisabled={isLoginButtonDisabled}
      />
    );

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
    if (authenticationConfig.strategy === AuthStrategy.login || authenticationConfig.strategy === AuthStrategy.ldap) {
      loginPane = loginForm;
    } else if (authenticationConfig.strategy === AuthStrategy.token) {
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
              variant="primary"
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
            <Button type="submit" onClick={this.handleSubmit} style={{ width: '100%' }} variant="primary">
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
        textContent="Service Mesh Observability."
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
