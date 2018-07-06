import { LoginActions, LoginActionKeys } from '../LoginActions';

const token =
  'eyJ3bGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyr1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoxNTI3NjIzNTAwfQ.klBh7tDeuMgZbsNWsUJWAqOBkRG30vURzKF6sZ8soB4';
const expiredAt = '018-05-29 21:51:40.186179601 +0200 CEST m=+36039.431579761';
const username = 'admin';

describe('LoginActions', () => {
  it('Login action request', () => {
    const expectedAction = {
      type: LoginActionKeys.LOGIN_REQUEST
    };
    expect(LoginActions.loginRequest()).toEqual(expectedAction);
  });

  it('Login action success', () => {
    const expectedAction = {
      type: LoginActionKeys.LOGIN_SUCCESS,
      token: { token: token, expired_at: expiredAt },
      username: username,
      logged: true
    };
    const result = LoginActions.loginSuccess({ token: token, expired_at: expiredAt }, username);
    expect(result.type).toEqual(expectedAction.type);
    expect(result.token).toEqual(expectedAction.token);
    expect(result.username).toEqual(expectedAction.username);
    expect(result.logged).toEqual(expectedAction.logged);
  });

  it('Login action failure', () => {
    const error = 'Error with username or password';
    const expectedAction = { type: LoginActionKeys.LOGIN_FAILURE, error: error };
    expect(LoginActions.loginFailure(error)).toEqual(expectedAction);
  });

  it('Login action logout', () => {
    const expectedAction = {
      type: LoginActionKeys.LOGOUT_SUCCESS,
      user: undefined,
      logged: false
    };
    expect(LoginActions.logoutSuccess()).toEqual(expectedAction);
  });
});
