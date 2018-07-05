import { createAction } from 'typesafe-actions';

export enum UserSettingsActionKeys {
  NAV_COLLAPSE = 'NAV_COLLAPSE'
}

export const UserSettingsActions = {
  navCollapse: createAction(UserSettingsActionKeys.NAV_COLLAPSE, (collapsed: boolean) => ({
    type: UserSettingsActionKeys.NAV_COLLAPSE,
    collapse: collapsed
  })),
  setNavCollapsed: (collapsed: boolean) => {
    return dispatch => {
      dispatch(UserSettingsActions.navCollapse(collapsed));
    };
  }
};
