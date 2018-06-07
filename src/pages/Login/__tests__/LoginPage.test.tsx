import * as React from 'react';
import { shallow } from 'enzyme';
import LoginPage from '../LoginPage';
import { KEY_CODES } from '../../../types/Common';

const LoginProps = {
  user: undefined,
  logging: false,
  error: undefined,
  message: '',
  authenticate: jest.fn()
};

const wrapper = shallow(<LoginPage {...LoginProps} />);
const username = 'admin';
const password = 'admin';

describe('#LoginPage render correctly', () => {
  it('should render LoginPage', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('should have a handles methods defined', () => {
    expect('handleChange' in wrapper.instance()).toBeTruthy();
    expect('handleSubmit' in wrapper.instance()).toBeTruthy();
    expect('handleKeyPress' in wrapper.instance()).toBeTruthy();
  });

  it('handleChange should change state', () => {
    let instance = wrapper.instance() as LoginPage;
    instance.handleChange({ target: { name: 'username', value: username } });
    expect(instance.state['username']).toBe(username);
    instance.handleChange({ target: { name: 'password', value: password } });
    expect(instance.state['password']).toBe(password);
  });

  it('handleKeyPress should call handleSubmit if enterkey', () => {
    let instance = wrapper.instance() as LoginPage;
    const spy = jest.spyOn(instance, 'handleSubmit');
    let event = {
      charCode: KEY_CODES.TAB_KEY,
      preventDefault: () => {
        return null;
      }
    };
    instance.handleKeyPress(event);
    expect(spy).not.toHaveBeenCalled();
    event.charCode = KEY_CODES.ENTER_KEY;
    instance.handleKeyPress(event);
    expect(spy).toHaveBeenCalled();
  });

  it('handleSubmit should call authenticate', () => {
    let instance = wrapper.instance() as LoginPage;
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
