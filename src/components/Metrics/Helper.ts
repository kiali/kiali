import assign from 'lodash/fp/assign';
import {
  TimeSeries,
  DashboardModel,
  AggregationModel,
  SingleLabelValues,
  LabelDisplayName,
  AllPromLabelsValues,
  PromLabel,
  MetricsQuery
} from 'k-charted-react';

import { MetricsSettingsDropdown, MetricsSettings } from '../MetricsOptions/MetricsSettings';
import MetricsDuration from '../MetricsOptions/MetricsDuration';
import { DurationInSeconds } from '../../types/Common';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { AllLabelsValues } from '../../types/Metrics';

export const extractLabelValuesOnSeries = (
  series: TimeSeries[],
  aggregations: AggregationModel[],
  extracted: AllLabelsValues
): void => {
  series.forEach(ts => {
    Object.keys(ts.labelSet).forEach(k => {
      const agg = aggregations.find(a => a.label === k);
      if (agg) {
        const value = ts.labelSet[k];
        let values = extracted.get(agg.displayName);
        if (!values) {
          values = {};
          extracted.set(agg.displayName, values);
        }
        values[value] = true;
      }
    });
  });
};

export const extractLabelValues = (dashboard: DashboardModel, previousValues: AllLabelsValues): AllLabelsValues => {
  // Find all labels on all series
  const labelsWithValues: AllLabelsValues = new Map();
  dashboard.aggregations.forEach(agg => labelsWithValues.set(agg.displayName, {}));
  dashboard.charts.forEach(chart => {
    if (chart.metric) {
      extractLabelValuesOnSeries(chart.metric, dashboard.aggregations, labelsWithValues);
    }
    if (chart.histogram) {
      Object.keys(chart.histogram).forEach(stat => {
        extractLabelValuesOnSeries(chart.histogram![stat], dashboard.aggregations, labelsWithValues);
      });
    }
  });
  // Keep existing show flag
  labelsWithValues.forEach((values: SingleLabelValues, key: LabelDisplayName) => {
    const previous = previousValues.get(key);
    if (previous) {
      Object.keys(values).forEach(k => {
        if (previous.hasOwnProperty(k)) {
          values[k] = previous[k];
        } else if (Object.getOwnPropertyNames(previous).length > 0) {
          values[k] = false;
        }
      });
    }
  });
  return labelsWithValues;
};

export const mergeLabelFilter = (
  labelValues: AllLabelsValues,
  label: LabelDisplayName,
  value: string,
  checked: boolean
): AllLabelsValues => {
  const newLabels = new Map();
  labelValues.forEach((val, key) => {
    const newVal = assign(val)({});
    if (key === label) {
      newVal[value] = checked;
    }
    newLabels.set(key, newVal);
  });
  return newLabels;
};

export const convertAsPromLabels = (aggregations: AggregationModel[], labels: AllLabelsValues): AllPromLabelsValues => {
  const promLabels = new Map<PromLabel, SingleLabelValues>();
  labels.forEach((val, k) => {
    const chartLabel = aggregations.find(l => l.displayName === k);
    if (chartLabel) {
      promLabels.set(chartLabel.label, val);
    }
  });
  return promLabels;
};

export const settingsToOptions = (settings: MetricsSettings, opts: MetricsQuery, aggregations?: AggregationModel[]) => {
  opts.avg = settings.showAverage;
  opts.quantiles = settings.showQuantiles;
  opts.byLabels = [];
  if (aggregations) {
    settings.activeLabels.forEach(lbl => {
      const agg = aggregations.find(a => a.displayName === lbl);
      if (agg) {
        opts.byLabels!.push(agg.label);
      }
    });
  }
};

export const initMetricsSettings = (opts: MetricsQuery, aggregations?: AggregationModel[]) => {
  settingsToOptions(MetricsSettingsDropdown.initialMetricsSettings(), opts, aggregations);
};

export const durationToOptions = (duration: DurationInSeconds, opts: MetricsQuery) => {
  opts.duration = duration;
  const intervalOpts = computePrometheusRateParams(duration);
  opts.step = intervalOpts.step;
  opts.rateInterval = intervalOpts.rateInterval;
};

export const initDuration = (opts: MetricsQuery): MetricsQuery => {
  durationToOptions(MetricsDuration.initialDuration(), opts);
  return opts;
};
