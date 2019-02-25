export enum AuthStrategy {
  login = 'login',
  anonymous = 'anonymous',
  openshift = 'openshift'
}

export interface AuthInfo {
  strategy: AuthStrategy;
  authorizationEndpoint?: string;
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
