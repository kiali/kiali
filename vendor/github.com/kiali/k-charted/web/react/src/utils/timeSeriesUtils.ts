import { TimeSeries, Histogram } from '../types/Metrics';
import { LabelSet, AllPromLabelsValues } from '../types/Labels';

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

export const filterAndNameMetric = (chartName: string, metrics: TimeSeries[], labelValues: AllPromLabelsValues): TimeSeries[] => {
  const filtered = metrics.filter(ts => isVisibleMetric(ts.labelSet, labelValues));
  return nameTimeSeries(filtered, chartName);
};

export const filterAndNameHistogram = (histogram: Histogram, labelValues: AllPromLabelsValues): Histogram => {
  const filtered: Histogram = {};
  Object.keys(histogram).forEach(stat => {
    filtered[stat] = histogram[stat].filter(ts => isVisibleMetric(ts.labelSet, labelValues));
    const statName = stat === 'avg' ? 'average' : 'quantile ' + stat;
    nameHistogramStat(filtered[stat], statName);
  });
  return filtered;
};

const nameHistogramStat = (matrix: TimeSeries[], stat: string): TimeSeries[] => {
  matrix.forEach(ts => {
    const labels = Object.keys(ts.labelSet)
      .filter(k => k !== 'reporter')
      .map(k => ts.labelSet[k])
      .join(',');
    if (labels === '') {
      // Ex: average // quantile 0.999 // etc.
      ts.name = stat;
    } else {
      // Ex: policy: average // stadium: quantile 0.999 // etc.
      ts.name = `${labels}: ${stat}`;
    }
  });
  return matrix;
};

const nameTimeSeries = (matrix: TimeSeries[], chartName: string): TimeSeries[] => {
  matrix.forEach(ts => {
    const labels = Object.keys(ts.labelSet)
      .filter(k => k !== 'reporter')
      .map(k => ts.labelSet[k])
      .join(',');
    if (labels === '') {
      // Ex: Request volume (ops)
      ts.name = chartName;
    } else {
      // Ex: policy // stadium // etc.
      ts.name = labels;
    }
  });
  return matrix;
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
