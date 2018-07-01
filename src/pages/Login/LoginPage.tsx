import React from 'react';
import { Alert, Row, Col, Form, FormGroup, FormControl, Button, HelpBlock } from 'patternfly-react';
import PropTypes from 'prop-types';
import { KEY_CODES } from '../../types/Common';
import SocialLink from '../../components/SocialLink/SocialLink';

const kialiTitle = require('../../assets/img/kiali-title.svg');

type LoginProps = {
  user: { username: string; password: string } | undefined;
  logging: boolean;
  error: any;
  message: string;
  authenticate: (username: string, password: string) => void;
};

type LoginState = {
  username: string;
  password: string;
};

export default class LoginPage extends React.Component<LoginProps, LoginState> {
  static contextTypes = {
    store: PropTypes.object
  };
  constructor(props: LoginProps) {
    super(props);

    // reset login status
    // this.props.dispatch(UserAction.logout());

    this.state = {
      username: '',
      password: ''
    };
  }

  handleChange = (e: any) => {
    const { name, value } = e.target;
    this.setState({ [name]: value });
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
                    {this.props.error && <Alert>{this.props.message}</Alert>}
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
                        {this.props.logging && !this.state.username && <HelpBlock>Username is required</HelpBlock>}
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
                        {this.props.logging && !this.state.password && <HelpBlock>Password is required</HelpBlock>}
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
                  <footer className={'login-pf-page-footer'}>
                    <SocialLink />
                  </footer>
                </Col>
              </Row>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}
