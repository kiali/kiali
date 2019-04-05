import { AuthConfig, AuthStrategy } from '../types/Auth';

const authenticationConfig: AuthConfig = {
  strategy: AuthStrategy.login,
  secretMissing: false
};

export default authenticationConfig;
