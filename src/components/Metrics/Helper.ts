import assign from 'lodash/fp/assign';
import {
  MonitoringDashboard,
  AllLabelsValues,
  SingleLabelValues,
  LabelDisplayName,
  PromLabel,
  Aggregation,
  AllPromLabelsValues,
  TimeSeries
} from '../../types/Metrics';
import { BaseMetricsOptions } from '../../types/MetricsOptions';
import { MetricsSettingsDropdown, MetricsSettings } from '../MetricsOptions/MetricsSettings';
import MetricsDuration from '../MetricsOptions/MetricsDuration';
import { DurationInSeconds } from '../../types/Common';
import { computePrometheusRateParams } from '../../services/Prometheus';

namespace MetricsHelper {
  export const extractLabelValuesOnSeries = (
    series: TimeSeries[],
    aggregations: Aggregation[],
    extracted: AllLabelsValues
  ): void => {
    series.forEach(ts => {
      Object.keys(ts.metric).forEach(k => {
        const agg = aggregations.find(a => a.label === k);
        if (agg) {
          const value = ts.metric[k];
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

  export const extractLabelValues = (
    dashboard: MonitoringDashboard,
    previousValues: AllLabelsValues
  ): AllLabelsValues => {
    // Find all labels on all series
    const labelsWithValues: AllLabelsValues = new Map();
    dashboard.aggregations.forEach(agg => labelsWithValues.set(agg.displayName, {}));
    dashboard.charts.forEach(chart => {
      if (chart.metric) {
        extractLabelValuesOnSeries(chart.metric.matrix, dashboard.aggregations, labelsWithValues);
      }
      if (chart.histogram) {
        Object.keys(chart.histogram).forEach(stat => {
          extractLabelValuesOnSeries(chart.histogram![stat].matrix, dashboard.aggregations, labelsWithValues);
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

  export const convertAsPromLabels = (aggregations: Aggregation[], labels: AllLabelsValues): AllPromLabelsValues => {
    const promLabels = new Map<PromLabel, SingleLabelValues>();
    labels.forEach((val, k) => {
      const chartLabel = aggregations.find(l => l.displayName === k);
      if (chartLabel) {
        promLabels.set(chartLabel.label, val);
      }
    });
    return promLabels;
  };

  export const settingsToOptions = (
    settings: MetricsSettings,
    opts: BaseMetricsOptions,
    aggregations?: Aggregation[]
  ) => {
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

  export const initMetricsSettings = (opts: BaseMetricsOptions, aggregations?: Aggregation[]) => {
    settingsToOptions(MetricsSettingsDropdown.initialMetricsSettings(), opts, aggregations);
  };

  export const durationToOptions = (duration: DurationInSeconds, opts: BaseMetricsOptions) => {
    opts.duration = duration;
    const intervalOpts = computePrometheusRateParams(duration);
    opts.step = intervalOpts.step;
    opts.rateInterval = intervalOpts.rateInterval;
  };

  export const initDuration = (opts: BaseMetricsOptions): BaseMetricsOptions => {
    durationToOptions(MetricsDuration.initialDuration(), opts);
    return opts;
  };
}

export default MetricsHelper;
