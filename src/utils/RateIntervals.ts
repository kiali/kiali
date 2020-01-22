import { serverConfig } from '../config/ServerConfig';

export const getName = (durationSeconds: number): string => {
  const name = serverConfig.durations[durationSeconds];
  if (name) {
    return name;
  }
  return durationSeconds + ' seconds';
};
