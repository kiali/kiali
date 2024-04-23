export interface AuthConfig {
  authorizationEndpoint?: string;
  authorizationEndpointPerCluster?: { [cluster: string]: string };
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

export interface SessionClusterInfo {
  name: string;
}

export interface SessionInfo {
  clusterInfo?: { [cluster: string]: SessionClusterInfo };
  expiresOn?: string;
  username?: string;
}
