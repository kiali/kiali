import UserSettingsState from '../UserSettingsState';
import { GlobalActions } from '../../actions/GlobalActions';
import { UserSettingsActions } from '../../actions/UserSettingsActions';

describe('UserSettingsState reducer', () => {
  it('should return the initial state', () => {
    expect(UserSettingsState(undefined, GlobalActions.unknown())).toEqual({
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
        UserSettingsActions.navCollapse(true)
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
        UserSettingsActions.setDuration(120)
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
        UserSettingsActions.setRefreshInterval(120)
      )
    ).toEqual({
      interface: { navCollapse: false },
      duration: 60,
      refreshInterval: 120
    });
  });
});
