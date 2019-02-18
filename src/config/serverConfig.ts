import deepFreeze from 'deep-freeze';
import { store } from '../store/ConfigStore';
import { KialiAppState, ServerConfig } from '../store/Store';
import { PersistPartial } from 'redux-persist';
import { DurationInSeconds } from '../types/Common';
import { forOwn, pickBy } from 'lodash';

// It's not great to access the store directly for convenience but the alternative is
// a huge code ripple just to access some server config. better to just have this one utility.
export const serverConfig = (): ServerConfig => {
  const actualState = store.getState() || ({} as KialiAppState & PersistPartial);
  return deepFreeze(actualState.serverConfig);
};

// getValidDurations returns a new object with only the durations <= retention
export const getValidDurations = (
  durations: { [key: string]: string },
  retention?: DurationInSeconds
): { [key: string]: string } => {
  const validDurations = pickBy(durations, (_, key) => {
    return !retention || Number(key) <= retention;
  });
  return validDurations;
};

// getValidDuration returns duration if it is a valid property key in durations, otherwise it return the first property
// key in durations.  It is assumed that durations has at least one property.
export const getValidDuration = (
  durations: { [key: string]: string },
  duration: DurationInSeconds
): DurationInSeconds => {
  let validDuration = 0;
  forOwn(durations, (value, key) => {
    const d = Number(key);
    if (d === duration) {
      validDuration = d;
    } else if (!validDuration) {
      validDuration = d;
    }
  });
  return validDuration;
};
