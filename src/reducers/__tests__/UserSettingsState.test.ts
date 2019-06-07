import UserSettingsState from '../UserSettingsState';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { GlobalActions } from '../../actions/GlobalActions';

describe('UserSettingsState reducer', () => {
  const RealDate = Date.now;
  const currentDate = Date.now();

  const mockDate = date => {
    global.Date.now = jest.fn(() => date) as any;
    return date;
  };

  beforeEach(() => {
    mockDate(currentDate);
  });

  afterEach(() => {
    global.Date.now = RealDate;
  });

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
