export interface AuthConfig {
  authorizationEndpoint?: string;
  logoutEndpoint?: string;
  logoutRedirect?: string;
  secretMissing?: boolean;
  strategy: AuthStrategy;
}

export type AuthInfo = {
  sessionInfo: SessionInfo;
} & AuthConfig;

export enum AuthStrategy {
  login = 'login',
  anonymous = 'anonymous',
  openshift = 'openshift'
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
