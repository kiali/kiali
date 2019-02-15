import { ServerConfig } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { ServerConfigActions } from '../actions/ServerConfigActions';

export const INITIAL_SERVER_CONFIG: ServerConfig | null = null;

// This Reducer allows changes to the 'serverConfig' portion of Redux Store
const serverConfig = (
  state: ServerConfig | null = INITIAL_SERVER_CONFIG,
  action: KialiAppAction
): ServerConfig | null => {
  switch (action.type) {
    case getType(ServerConfigActions.setServerConfig):
      return action.payload;
    default:
      return state;
  }
};

export default serverConfig;
