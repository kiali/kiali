import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPageComponent } from '../LoginPage';
import { LoginStatus } from '../../../store/Store';

const LoginProps = {
  authenticate: jest.fn(),
  checkCredentials: jest.fn(),
  isPostLoginPerforming: false,
  message: '',
  status: LoginStatus.loggedOut
};

const username = 'admin';
const password = 'admin';

describe('#LoginPage render correctly', () => {
  it('should render LoginPage', () => {
    const { container } = render(<LoginPageComponent {...LoginProps} />);
    expect(container).toBeDefined();
    expect(container).toMatchSnapshot();
  });

  it('should have a handles methods defined', () => {
    const ref = React.createRef<LoginPageComponent>();
    render(<LoginPageComponent ref={ref} {...LoginProps} />);
    expect(ref.current).toBeTruthy();
    expect(typeof ref.current!.handlePasswordChange).toBe('function');
    expect(typeof ref.current!.handleSubmit).toBe('function');
  });

  it('handleChange should change state', async () => {
    const user = userEvent.setup();
    const ref = React.createRef<LoginPageComponent>();
    render(<LoginPageComponent ref={ref} {...LoginProps} />);
    await user.type(screen.getByLabelText(/token/i), password);
    expect(ref.current!.state.password).toBe(password);
  });

  it('handleSubmit should call authenticate', async () => {
    const user = userEvent.setup();
    const authenticate = jest.fn();
    render(<LoginPageComponent {...LoginProps} authenticate={authenticate} />);
    await user.type(screen.getByLabelText(/token/i), username);
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(authenticate).toHaveBeenCalled();
  });

  it('should disable the login button when logging in', () => {
    const props = { ...LoginProps, status: LoginStatus.logging };
    render(<LoginPageComponent {...props} />);
    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
  });

  it('should disable the login button when performing post login', () => {
    const props = { ...LoginProps, isPostLoginPerforming: true };
    render(<LoginPageComponent {...props} />);
    expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
  });

  it('should not disable the login button on error', () => {
    const props = { ...LoginProps, status: LoginStatus.error };
    render(<LoginPageComponent {...props} />);
    expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
  });
});
