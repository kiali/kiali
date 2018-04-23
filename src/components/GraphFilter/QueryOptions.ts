// TODO [KIALI-437] Use enums instead of string keys
const GraphQueryOptionsPerDuration = {
  60: { step: 2, rateInterval: '1m' }, // 1m - 60/2=30 buckets which is 1 datapoint per 2s
  600: { step: 20, rateInterval: '1m' }, // 10m - 600/20=30 buckets which is 1 datapoint per 20s
  1800: { step: 60, rateInterval: '1m' }, // 30m - 1800/60=30 buckets which is 1 datapoint per 1m
  3600: { step: 120, rateInterval: '1m' }, // 1h - 3600/120=30 buckets which is 1 datapoint per 2m
  14400: { step: 480, rateInterval: '1m' }, // 4h - 14400/480=30 buckets which is 1 datapoint per 8m
  28800: { step: 960, rateInterval: '1m' }, // 8h - 28800/960=30 buckets which is 1 datapoint per 16m
  86400: { step: 2880, rateInterval: '1m' }, // 1d - 86400/2880=30 buckets which is 1 datapoint per 48m
  604800: { step: 20160, rateInterval: '1m' }, // 7d - 604800/20160=30 buckets which is 1 datapoint per 5.6h
  2592000: { step: 86400, rateInterval: '1m' } // 30d - 2592000/86400=30 buckets which is 1 datapoint per 1d
};

const DEFAULT_KEY = 60;

const DEFAULT = { key: DEFAULT_KEY, ...GraphQueryOptionsPerDuration[DEFAULT_KEY] };

const getOption = (key: number) => {
  return GraphQueryOptionsPerDuration.hasOwnProperty(key)
    ? { key: key, ...GraphQueryOptionsPerDuration[key] }
    : DEFAULT;
};

export { getOption, DEFAULT };
