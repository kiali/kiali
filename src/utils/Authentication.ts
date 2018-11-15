import { store } from '../store/ConfigStore';
import { KialiAppState } from '../store/Store';
import { PersistPartial } from 'redux-persist';
import { AuthToken } from '../types/Common';
import { authenticationToken } from './AuthenticationToken';

export const authentication = (): AuthToken => {
  const actualState = store.getState() || ({} as KialiAppState & PersistPartial);
  return authenticationToken(actualState);
};
