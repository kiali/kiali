import type { AxiosHeaders } from 'axios';
import { getType } from 'typesafe-actions';
import { LoginActions } from '../LoginActions';
import { LoginThunkActions } from '../LoginThunkActions';
import { LoginStatus } from '../../store/Store';
import * as API from '../../services/Api';

const session = {
  expiresOn: '2018-05-29 21:51:40.186179601 +0200 CEST m=+36039.431579761',
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

describe('LoginThunkActions.logout', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: 'http://localhost/kiali' }
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    });
    rstest.clearAllMocks();
  });

  it('redirects to IdP when backend returns 200 with redirect_url', async () => {
    rstest.spyOn(API, 'logout').mockResolvedValue({
      status: 200,
      data: { redirect_url: 'https://idp.example.com/logout?id_token_hint=abc' },
      statusText: 'OK',
      headers: {},
      config: { headers: {} as AxiosHeaders }
    });

    const dispatch = rstest.fn();
    await LoginThunkActions.logout()(dispatch);

    expect(window.location.href).toBe('https://idp.example.com/logout?id_token_hint=abc');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dispatches logoutSuccess when backend returns 204', async () => {
    rstest.spyOn(API, 'logout').mockResolvedValue({
      status: 204,
      data: {},
      statusText: 'No Content',
      headers: {},
      config: { headers: {} as AxiosHeaders }
    });

    const dispatch = rstest.fn();
    await LoginThunkActions.logout()(dispatch);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ status: LoginStatus.loggedOut })
      })
    );
  });
});
