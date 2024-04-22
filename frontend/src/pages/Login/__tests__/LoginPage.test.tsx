import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';
import { LoginPageComponent } from '../LoginPage';
import { LoginStatus } from '../../../store/Store';

const LoginProps = {
  status: LoginStatus.loggedOut,
  authenticate: jest.fn(),
  checkCredentials: jest.fn(),
  isPostLoginPerforming: false,
  message: ''
};

const wrapper = shallow(<LoginPageComponent {...LoginProps} />);
const username = 'admin';
const password = 'admin';

describe('#LoginPage render correctly', () => {
  it('should render LoginPage', () => {
    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('should have a handles methods defined', () => {
    const instance = wrapper.instance();
    expect('handlePasswordChange' in instance).toBeTruthy();
    expect('handleSubmit' in instance).toBeTruthy();
  });

  it('handleChange should change state', () => {
    const instance = wrapper.instance() as LoginPageComponent;
    instance.handlePasswordChange(password);
    expect(instance.state.password).toBe(password);
  });

  it('handleSubmit should call authenticate', () => {
    const instance = wrapper.instance() as LoginPageComponent;
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

  it('should disable the login button when logging in', () => {
    const props = { ...LoginProps, status: LoginStatus.logging };
    const wrapper = shallow(<LoginPageComponent {...props} />);
    const submitButton = wrapper.find(Button);
    expect(submitButton.exists()).toBeTruthy();
    expect(submitButton.prop('isDisabled')).toBeTruthy();
  });

  it('should disable the login button when performing post login', () => {
    const props = { ...LoginProps, isPostLoginPerforming: true };
    const wrapper = shallow(<LoginPageComponent {...props} />);
    const submitButton = wrapper.find(Button);
    expect(submitButton.exists()).toBeTruthy();
    expect(submitButton.prop('isDisabled')).toBeTruthy();
  });

  it('should not disable the login button on error', () => {
    const props = { ...LoginProps, status: LoginStatus.error };
    const wrapper = shallow(<LoginPageComponent {...props} />);
    const submitButton = wrapper.find(Button);
    expect(submitButton.exists()).toBeTruthy();
    expect(submitButton.prop('isDisabled')).toBeFalsy();
  });
});
