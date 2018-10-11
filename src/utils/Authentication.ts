import { store } from '../store/ConfigStore';
import { KialiAppState } from '../store/Store';
import { PersistPartial } from 'redux-persist';

export const authentication = () => {
  const actualState = store.getState() || ({} as KialiAppState & PersistPartial);
  if (actualState.authentication.token !== undefined) {
    return 'Bearer ' + actualState.authentication.token.token;
  }
  return '';
};
