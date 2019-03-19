import { ActionType, createAction, createStandardAction } from 'typesafe-actions';

enum JaegerActionKeys {
  SET_URL = 'SET_URL',

  // ENABLE INTEGRAION WITH JAEGER
  SET_ENABLE_INTEGRATION = 'SET_ENABLE_INTEGRATION'
}

// synchronous action creators
export const JaegerActions = {
  setUrl: createAction(JaegerActionKeys.SET_URL, resolve => (url: string) =>
    resolve({
      url: url
    })
  ),
  setEnableIntegration: createStandardAction(JaegerActionKeys.SET_ENABLE_INTEGRATION)<boolean>()
};

export type JaegerAction = ActionType<typeof JaegerActions>;
