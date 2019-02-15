import { ActionType, createStandardAction } from 'typesafe-actions';
import { ServerConfig } from '../store/Store';

enum ServerConfigActionKeys {
  SET_SERVER_CONFIG = 'SET_SERVER_CONFIG'
}

// synchronous action creators
export const ServerConfigActions = {
  setServerConfig: createStandardAction(ServerConfigActionKeys.SET_SERVER_CONFIG)<ServerConfig | null>()
};

export type ServerConfigAction = ActionType<typeof ServerConfigActions>;
