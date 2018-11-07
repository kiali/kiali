import { UserSettingsActionKeys, UserSettingsActions } from '../UserSettingsActions';

describe('UserSettingsActions', () => {
  it('should set the duration', () => {
    expect(UserSettingsActions.setDuration(60)).toEqual({
      type: UserSettingsActionKeys.SET_DURATION,
      payload: 60
    });
  });

  it('should set the refresh interval', () => {
    expect(UserSettingsActions.setRefreshInterval(60)).toEqual({
      type: UserSettingsActionKeys.SET_REFRESH_INTERVAL,
      payload: 60
    });
  });

  it('should set Nav Collapsed', () => {
    expect(UserSettingsActions.navCollapse(true)).toEqual({
      type: UserSettingsActionKeys.NAV_COLLAPSE,
      collapse: true
    });
  });
});
