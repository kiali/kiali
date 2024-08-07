export interface AuthConfig {
  authorizationEndpoint?: string;
  logoutEndpoint?: string;
  logoutRedirect?: string;
  strategy: AuthStrategy;
}

export type AuthInfo = {
  sessionInfo: SessionInfo;
} & AuthConfig;

export enum AuthStrategy {
  anonymous = 'anonymous',
  openshift = 'openshift',
  token = 'token',
  openid = 'openid',
  header = 'header'
}

// Stores the result of a computation:
// hold = stop all computation and wait for a side-effect, such as a redirect
// continue = continue...
// success = authentication was a success, session is available
// failure = authentication failed, session is undefined but error is available
export enum AuthResult {
  HOLD = 'hold',
  CONTINUE = 'continue',
  SUCCESS = 'success',
  FAILURE = 'failure'
}

export interface SessionInfo {
  username?: string;
  expiresOn?: string;
}

export const getCSRFToken = (): string | undefined => {
  const cookiePrefix = 'csrf-token=';

  return (
    document &&
    document.cookie &&
    document.cookie
      .split(';')
      .map(c => c.trim())
      .filter(c => c.startsWith(cookiePrefix))
      .map(c => c.slice(cookiePrefix.length))
      .pop()
  );
};
