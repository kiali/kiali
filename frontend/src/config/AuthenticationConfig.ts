import { AuthConfig, AuthStrategy } from '../types/Auth';

export const authenticationConfig: AuthConfig = {
  strategy: AuthStrategy.token
};

// Returns true if authentication strategy is either 'openshift' or 'openid'
export const isAuthStrategyOAuth = () =>
  authenticationConfig.strategy === AuthStrategy.openshift || authenticationConfig.strategy === AuthStrategy.openid;
