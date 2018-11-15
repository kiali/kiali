import { UserSettingsActions } from '../UserSettingsActions';
import { getType } from 'typesafe-actions';

describe('UserSettingsActions', () => {
  it('should set the duration', () => {
    const setDurationAction = UserSettingsActions.setDuration(60);
    expect(setDurationAction.type).toEqual(getType(UserSettingsActions.setDuration));
    expect(setDurationAction.payload).toEqual(60);
  });

  it('should set the refresh interval', () => {
    const setRefreshAction = UserSettingsActions.setRefreshInterval(60);
    expect(setRefreshAction.type).toEqual(getType(UserSettingsActions.setRefreshInterval));
    expect(setRefreshAction.payload).toEqual(60);
  });

  it('should set Nav Collapsed', () => {
    expect(UserSettingsActions.navCollapse(true).payload).toEqual({
      collapse: true
    });
  });
});
