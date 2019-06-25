import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';
import { LoginPage } from '../LoginPage';
import { LoginStatus } from '../../../store/Store';

const LoginProps = {
  status: LoginStatus.loggedOut,
  authenticate: jest.fn(),
  checkCredentials: jest.fn(),
  isPostLoginPerforming: false
};

const wrapper = shallow(<LoginPage {...LoginProps} />);
const username = 'admin';
const password = 'admin';

describe('#LoginPage render correctly', () => {
  it('should render LoginPage', () => {
    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('should have a handles methods defined', () => {
    const instance = wrapper.instance();
    expect('handleUsernameChange' in instance).toBeTruthy();
    expect('handlePasswordChange' in instance).toBeTruthy();
    expect('handleSubmit' in instance).toBeTruthy();
  });

  it('handleChange should change state', () => {
    const instance = wrapper.instance() as LoginPage;
    instance.handleUsernameChange(username);
    expect(instance.state.username).toBe(username);
    instance.handlePasswordChange(password);
    expect(instance.state.password).toBe(password);
  });

  it('handleSubmit should call authenticate', () => {
    const instance = wrapper.instance() as LoginPage;
    instance.setState({ username: username, password: password });
    const spy = jest.spyOn(instance.props, 'authenticate');
    const event = {
      preventDefault: () => {
        return null;
      }
    };
    instance.handleSubmit(event);
    expect(spy).toHaveBeenCalled();
  });
});
