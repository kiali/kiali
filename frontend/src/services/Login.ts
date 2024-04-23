import * as API from './Api';
import moment from 'moment';

import { LoginSession, KialiAppState } from '../store/Store';
import { AuthStrategy, AuthResult, AuthConfig } from '../types/Auth';
import { TimeInMilliseconds } from '../types/Common';
import { KialiDispatch } from '../types/Redux';
import { authenticationConfig } from '../config/AuthenticationConfig';

export interface LoginResult {
  error?: any;
  session?: LoginSession;
  status: AuthResult;
}

interface LoginStrategy<T extends unknown> {
  perform: (request: DispatchRequest<T>) => Promise<LoginResult>;
  prepare: (info: AuthConfig) => Promise<AuthResult>;
}

interface DispatchRequest<T> {
  data: T;
  dispatch: KialiDispatch;
  state: KialiAppState;
}

type NullDispatch = DispatchRequest<unknown>;

class AnonymousLogin implements LoginStrategy<unknown> {
  public async prepare(_info: AuthConfig): Promise<AuthResult> {
    return AuthResult.CONTINUE;
  }

  public async perform(_request: NullDispatch): Promise<LoginResult> {
    return {
      status: AuthResult.FAILURE,
      session: {
        username: API.ANONYMOUS_USER,
        expiresOn: moment().add(1, 'd').toISOString()
      }
    };
  }
}

interface WebLoginData {
  password: string;
  username: string;
}

class TokenLogin implements LoginStrategy<WebLoginData> {
  public async prepare(_info: AuthConfig): Promise<AuthResult> {
    return AuthResult.CONTINUE;
  }

  public async perform(request: DispatchRequest<WebLoginData>): Promise<LoginResult> {
    const session = (await API.login({ username: '', password: '', token: request.data.password })).data;

    return {
      status: AuthResult.SUCCESS,
      session: session
    };
  }
}

class HeaderLogin implements LoginStrategy<WebLoginData> {
  public async prepare(_info: AuthConfig): Promise<AuthResult> {
    return AuthResult.CONTINUE;
  }

  public async perform(_request: NullDispatch): Promise<LoginResult> {
    const session = (await API.login({ username: '', password: '', token: '' })).data;

    return {
      status: AuthResult.SUCCESS,
      session: session
    };
  }
}

class OAuthLogin implements LoginStrategy<unknown> {
  public async prepare(info: AuthConfig): Promise<AuthResult> {
    if (!info.authorizationEndpoint) {
      return AuthResult.FAILURE;
    }
    return AuthResult.HOLD;
  }

  public async perform(_request: NullDispatch): Promise<LoginResult> {
    return {
      status: AuthResult.SUCCESS
      // session: session
    };
  }
}

export class LoginDispatcher {
  strategyMapping: Map<AuthStrategy, LoginStrategy<any>>;
  info?: AuthConfig;

  constructor() {
    this.strategyMapping = new Map();

    this.strategyMapping.set(AuthStrategy.anonymous, new AnonymousLogin());
    this.strategyMapping.set(AuthStrategy.token, new TokenLogin());
    this.strategyMapping.set(AuthStrategy.header, new HeaderLogin());
    this.strategyMapping.set(AuthStrategy.openshift, new OAuthLogin());
    this.strategyMapping.set(AuthStrategy.openid, new OAuthLogin());
  }

  public async prepare(): Promise<AuthResult> {
    const info = authenticationConfig;
    const strategy = this.strategyMapping.get(info.strategy)!;

    try {
      const delay = async (ms: TimeInMilliseconds = 3000): Promise<unknown> => {
        return new Promise(resolve => setTimeout(resolve, ms));
      };

      const result = await strategy.prepare(info);

      // If preparation requires a hold time, with things such as redirects that
      // require the auth flow to stop running for a while, we do that.
      //
      // If it fails to run for a while, we return a failure state.
      // This assume that the user is leaving the page for auth, which should be
      // the case for oauth implementations.
      if (result === AuthResult.HOLD) {
        await delay();

        return Promise.reject({
          status: AuthResult.FAILURE,
          error: 'Failed to redirect user to authentication page.'
        });
      } else {
        return result;
      }
    } catch (error) {
      return Promise.reject({ status: AuthResult.FAILURE, error });
    }
  }

  public async perform(request: DispatchRequest<any>): Promise<LoginResult> {
    const strategy = this.strategyMapping.get(authenticationConfig.strategy)!;

    try {
      return await strategy.perform(request);
    } catch (error) {
      return Promise.reject({ status: AuthResult.FAILURE, error });
    }
  }
}
