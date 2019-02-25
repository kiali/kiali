import { KialiAppState } from '../store/Store';
import { AuthToken } from '../types/Common';

export const authenticationToken = (state: KialiAppState): AuthToken => {
  if (state.authentication.session !== undefined) {
    return 'Bearer ' + state.authentication.session.token;
  }

  return '';
};
