import { authentication } from '../Authentication';
import { store } from '../../store/ConfigStore';
import { LoginActions } from '../../actions/LoginActions';

const session = {
  token:
    'eyJ3bGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyr1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoxNTI3NjIzNTAwfQ.klBh7tDeuMgZbsNWsUJWAqOBkRG30vURzKF6sZ8soB4',
  expiresOn: '018-05-29 21:51:40.186179601 +0200 CEST m=+36039.431579761',
  username: 'admin'
};

describe('Authentication', () => {
  it('should return empty object without store', () => {
    expect(authentication()).toEqual('');
  });

  it('should return username and password object ', () => {
    store.dispatch(LoginActions.loginSuccess(session));
    expect(authentication()).toEqual('Bearer ' + session.token);
  });
});
