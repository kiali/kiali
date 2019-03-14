import React from 'react';
import { Alert, Button, Col, Form, FormControl, FormGroup, HelpBlock, Row } from 'patternfly-react';
import { KEY_CODES } from '../../types/Common';
import { LoginSession, LoginStatus } from '../../store/Store';

const kialiTitle = require('../../assets/img/logo-login.svg');

type LoginProps = {
  status: LoginStatus;
  session?: LoginSession;
  message?: string;
  error?: any;
  authenticate: (username: string, password: string) => void;
  checkCredentials: () => void;
};

type LoginState = {
  username: string;
  password: string;
};

export default class LoginPage extends React.Component<LoginProps, LoginState> {
  static contextTypes = {
    store: () => null
  };
  constructor(props: LoginProps) {
    super(props);

    this.state = {
      username: '',
      password: ''
    };
  }

  componentDidMount() {
    // handle initial path from the browser
    this.props.checkCredentials();
  }

  handleChange = (e: any) => {
    const { name, value } = e.target;
    this.setState({ [name]: value } as Pick<LoginState, keyof LoginState>);
  };

  handleSubmit = (e: any) => {
    e.preventDefault();
    if (this.state.username.length > 0 && this.state.password.length > 0 && this.props.authenticate) {
      this.props.authenticate(this.state.username, this.state.password);
    }
  };

  handleKeyPress = (e: any) => {
    if (e.charCode === KEY_CODES.ENTER_KEY) {
      this.handleSubmit(e);
    }
  };

  render() {
    return (
      <div className={'login-pf-page'}>
        <div className={'container-fluid'}>
          <Row>
            <Col sm={8} smOffset={2} md={6} mdOffset={3} lg={6} lgOffset={3}>
              <header className={'login-pf-page-header'}>
                <img className={'login-pf-brand'} src={kialiTitle} alt={'logo'} />
              </header>
              <Row>
                <Col sm={10} smOffset={1} md={8} mdOffset={2} lg={8} lgOffset={2}>
                  <div className={'card-pf'}>
                    <header className={'login-pf-header'} />
                    {this.props.status === LoginStatus.error && <Alert>{this.props.message}</Alert>}
                    {this.props.status === LoginStatus.expired && (
                      <Alert type="warning">Your session has expired or was terminated in another window.</Alert>
                    )}
                    <Form onSubmit={e => this.handleSubmit(e)} id={'kiali-login'}>
                      <FormGroup>
                        <FormControl
                          id="username"
                          type="text"
                          name="username"
                          onChange={this.handleChange}
                          placeholder={'Username'}
                          disabled={false}
                          required={true}
                          onKeyPress={this.handleKeyPress}
                        />
                        {this.props.status === LoginStatus.logging && !this.state.username && (
                          <HelpBlock>Username is required</HelpBlock>
                        )}
                      </FormGroup>
                      <FormGroup>
                        <FormControl
                          type="password"
                          name="password"
                          onChange={this.handleChange}
                          placeholder={'Password'}
                          disabled={false}
                          required={true}
                          onKeyPress={this.handleKeyPress}
                        />
                        {this.props.status === LoginStatus.logging && !this.state.password && (
                          <HelpBlock>Password is required</HelpBlock>
                        )}
                      </FormGroup>
                      <Button
                        type="submit"
                        onKeyPress={this.handleKeyPress}
                        className="btn btn-primary btn-block btn-lg"
                      >
                        Log In
                      </Button>
                    </Form>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}
