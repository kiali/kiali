import { getType } from 'typesafe-actions';
import { LoginActions } from '../LoginActions';
import { LoginStatus } from '../../store/Store';

const session = {
  expiresOn: '018-05-29 21:51:40.186179601 +0200 CEST m=+36039.431579761',
  username: 'admin'
};

describe('LoginActions', () => {
  it('Login action success', () => {
    const result = LoginActions.loginSuccess(session);

    expect(result.type).toEqual(getType(LoginActions.loginSuccess));
    expect(result.payload.session).toEqual(session);
    expect(result.payload.status).toEqual(LoginStatus.loggedIn);
  });

  it('Login action failure', () => {
    const error = 'Error with username or password';
    const expectedAction = { error: error, status: LoginStatus.error, session: undefined };
    expect(LoginActions.loginFailure(error).payload).toEqual(expectedAction);
  });

  it('Login action logout', () => {
    const expectedAction = {
      status: LoginStatus.loggedOut,
      session: undefined
    };

    expect(LoginActions.logoutSuccess().payload).toEqual(expectedAction);
  });
});
