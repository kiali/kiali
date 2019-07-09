import { LabelSet } from './Labels';

// First is timestamp, second is value
export type Datapoint = [number, number];

export interface TimeSeries {
  labelSet: LabelSet;
  values: Datapoint[];
  name?: string;
}

export type Histogram = { [key: string]: TimeSeries[] };
