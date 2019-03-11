import { serverConfig } from '../config/serverConfig';

export const tuples: [number, string][] = Object.keys(serverConfig.durations).map(key => {
  const tuple: [number, string] = [+key, serverConfig.durations[key]];
  return tuple;
});

export const getName = (durationSeconds: number): string => {
  const name = serverConfig.durations[durationSeconds];
  if (name) {
    return name;
  }
  return 'Last ' + durationSeconds + ' seconds';
};
