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
      if (chart.counterRate) {
        extractLabelValuesOnSeries(chart.counterRate.matrix, dashboard.aggregations, labelsWithValues);
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
    let newLabels = new Map();
    labelValues.forEach((val, key) => {
      let newVal = assign(val)({});
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
}

export default MetricsHelper;
