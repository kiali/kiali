import { store } from '../store/ConfigStore';
import { KialiAppState } from '../store/Store';
import { PersistPartial } from 'redux-persist';
import { AuthToken } from '../types/Common';

export const authentication = (): AuthToken => {
  const actualState = store.getState() || ({} as KialiAppState & PersistPartial);
  if (actualState.authentication.token !== undefined) {
    return 'Bearer ' + actualState.authentication.token.token;
  }
  return '';
};
