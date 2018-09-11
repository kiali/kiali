import { config } from '../config';

const mapIntervals: { [key: number]: string } = config().toolbar.intervalDuration;
export const tuples: [number, string][] = Object.keys(mapIntervals).map(key => {
  const tuple: [number, string] = [+key, mapIntervals[key]];
  return tuple;
});

export const getName = (durationSeconds: number): string => {
  const name = mapIntervals[durationSeconds];
  if (name) {
    return name;
  }
  return 'Last ' + durationSeconds + ' seconds';
};
