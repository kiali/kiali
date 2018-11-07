import UserSettingsState from '../UserSettingsState';
import { UserSettingsActionKeys } from '../../actions/UserSettingsActions';

describe('UserSettingsState reducer', () => {
  it('should return the initial state', () => {
    expect(UserSettingsState(undefined, {})).toEqual({
      interface: { navCollapse: false },
      duration: 60,
      refreshInterval: 15000
    });
  });

  it('should collapse the nav', () => {
    expect(
      UserSettingsState(
        {
          interface: { navCollapse: false },
          duration: 60,
          refreshInterval: 60
        },
        {
          type: UserSettingsActionKeys.NAV_COLLAPSE,
          collapse: true
        }
      )
    ).toEqual({
      interface: { navCollapse: true },
      duration: 60,
      refreshInterval: 60
    });
  });

  it('should set duration', () => {
    expect(
      UserSettingsState(
        {
          interface: { navCollapse: false },
          duration: 60,
          refreshInterval: 60
        },
        {
          type: UserSettingsActionKeys.SET_DURATION,
          payload: 120
        }
      )
    ).toEqual({
      interface: { navCollapse: false },
      duration: 120,
      refreshInterval: 60
    });
  });

  it('should set refresh interval', () => {
    expect(
      UserSettingsState(
        {
          interface: { navCollapse: false },
          duration: 60,
          refreshInterval: 60
        },
        {
          type: UserSettingsActionKeys.SET_REFRESH_INTERVAL,
          payload: 120
        }
      )
    ).toEqual({
      interface: { navCollapse: false },
      duration: 60,
      refreshInterval: 120
    });
  });
});
