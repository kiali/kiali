import { KialiAppState } from '../store/Store';
import { AuthToken } from '../types/Common';

export const authenticationToken = (state: KialiAppState): AuthToken => {
  if (state.authentication.token !== undefined) {
    return 'Bearer ' + state.authentication.token.token;
  }
  return '';
};
