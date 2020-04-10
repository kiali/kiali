import { TimeSeries, NamedTimeSeries } from '../types/Metrics';
import { LabelSet, AllPromLabelsValues, nameLabel, statLabel } from '../types/Labels';

type KVMapper = (key: string, value: string) => string;
export type LabelsInfo = {
  values: AllPromLabelsValues,
  prettifier?: KVMapper
};

const isVisibleMetric = (labels: LabelSet, labelValues: AllPromLabelsValues): boolean => {
  for (const promLabelName in labels) {
    if (labels.hasOwnProperty(promLabelName)) {
      const actualValue = labels[promLabelName];
      const values = labelValues.get(promLabelName);
      if (values && values.hasOwnProperty(actualValue) && !values[actualValue]) {
        return false;
      }
    }
  }
  return true;
};

export const filterAndNameMetric = (metrics: TimeSeries[], labels: LabelsInfo): NamedTimeSeries[] => {
  const filtered = metrics.filter(ts => isVisibleMetric(ts.labelSet, labels.values));
  return nameTimeSeries(filtered, labels.prettifier);
};

const mapStatForDisplay = (stat: string): string => {
  switch (stat) {
    case '0.5': return 'p50';
    case '0.95': return 'p95';
    case '0.99': return 'p99';
    case '0.999': return 'p99.9';
    default: return stat;
  }
};

const nameTimeSeries = (series: TimeSeries[], labelPrettifier?: KVMapper): NamedTimeSeries[] => {
  let hasSeveralFamilyNames = false;
  if (series.length > 0) {
    const firstName = series[0].labelSet[nameLabel];
    hasSeveralFamilyNames = series.some(s => s.labelSet[nameLabel] !== firstName);
  }
  return series.map(ts => {
    const name = ts.labelSet[nameLabel];
    const stat = mapStatForDisplay(ts.labelSet[statLabel]);
    const otherLabels = Object.keys(ts.labelSet)
      .filter(k => k !== nameLabel && k !== statLabel)
      .map(k => {
        const val = ts.labelSet[k];
        return labelPrettifier ? labelPrettifier(k, val) : val;
      });
    const labels = (stat ? [stat] : []).concat(otherLabels).join(',');
    let finalName = '';
    if (labels === '') {
      // E.g. Serie A
      finalName = name;
    } else if (hasSeveralFamilyNames) {
      // E.g. Serie A [p99,another_label_value]
      finalName = `${name} [${labels}]`;
    } else {
      // E.g. p99,another_label_value
      // (since we only have a single serie name, it is considered implicit and we save some characters space)
      finalName = labels;
    }
    return {
      ...ts,
      name: finalName
    };
  });
};

export const generateKey = (ts: TimeSeries[], chartName: string): string => {
  if (ts.length === 0) {
    return 'blank';
  }

  const labelNames = Object.keys(ts[0].labelSet);
  if (labelNames.length === 0) {
    return chartName;
  }

  return chartName + '-' + labelNames.join('-');
};
