import {
  TimeSeries,
  DashboardModel,
  AggregationModel,
  SingleLabelValues,
  AllPromLabelsValues,
  PromLabel,
  MetricsQuery
} from '@kiali/k-charted-pf4';

import { MetricsSettings, LabelsSettings, Quantiles, LabelSettings } from '../MetricsOptions/MetricsSettings';
import { boundsToDuration, guardTimeRange, TimeRange, DurationInSeconds } from '../../types/Common';
import { computePrometheusRateParams } from '../../services/Prometheus';
import history, { URLParam } from '../../app/History';
import responseFlags from 'utils/ResponseFlags';

// Default to 10 minutes. Showing timeseries to only 1 minute doesn't make so much sense.
export const defaultMetricsDuration: DurationInSeconds = 600;

export const combineLabelsSettings = (newSettings: LabelsSettings, stateSettings: LabelsSettings): LabelsSettings => {
  // Labels: keep existing on/off flag
  // This is allowed because the labels filters state is managed only from this component,
  // so we can override them in props from state
  // LabelsSettings received from props contains the names of the filters with only a default on/off flag.
  newSettings.forEach((lblObj, promLabel) => {
    const stateObj = stateSettings.get(promLabel);
    if (stateObj) {
      lblObj.checked = stateObj.checked;
      if (stateObj.defaultValue === false) {
        // 1st pass: override default filters (this case only happens when filters are defined from URL)
        Object.keys(lblObj.values).forEach(k => {
          lblObj.values[k] = false;
        });
      }
      // 2nd pass: retrieve previous filters
      Object.keys(stateObj.values).forEach(k => {
        lblObj.values[k] = stateObj.values[k];
      });
    }
  });
  return newSettings;
};

export const extractLabelsSettingsOnSeries = (
  series: TimeSeries[],
  aggregations: AggregationModel[],
  extracted: LabelsSettings
): void => {
  series.forEach(ts => {
    Object.keys(ts.labelSet).forEach(k => {
      const agg = aggregations.find(a => a.label === k);
      if (agg) {
        const value = ts.labelSet[k];
        let lblObj = extracted.get(agg.label);
        if (!lblObj) {
          lblObj = {
            checked: true,
            displayName: agg.displayName,
            values: {},
            defaultValue: true
          };
          extracted.set(agg.label, lblObj);
        } else {
          lblObj.checked = true;
        }
        lblObj.values[value] = true;
      }
    });
  });
};

export const extractLabelsSettings = (dashboard: DashboardModel, stateSettings: LabelsSettings): LabelsSettings => {
  // Find all labels on all series
  const newSettings: LabelsSettings = new Map();
  dashboard.aggregations.forEach(agg =>
    newSettings.set(agg.label, {
      checked: false,
      displayName: agg.displayName,
      values: {},
      defaultValue: true
    })
  );
  dashboard.charts.forEach(chart => extractLabelsSettingsOnSeries(chart.metrics, dashboard.aggregations, newSettings));
  return combineLabelsSettings(newSettings, stateSettings);
};

export const mergeLabelFilter = (
  lblSettings: LabelsSettings,
  label: PromLabel,
  value: string,
  checked: boolean
): LabelsSettings => {
  // Note: we don't really care that the new map references same objects as the old one (at least at the moment) so shallow copy is fine
  const newSettings = new Map(lblSettings);
  const objLbl = newSettings.get(label);
  if (objLbl) {
    objLbl.values[value] = checked;
  }
  return newSettings;
};

export const convertAsPromLabels = (lblSettings: LabelsSettings): AllPromLabelsValues => {
  const promLabels = new Map<PromLabel, SingleLabelValues>();
  lblSettings.forEach((objLbl, k) => {
    promLabels.set(k, objLbl.values);
  });
  return promLabels;
};

export const settingsToOptions = (settings: MetricsSettings, opts: MetricsQuery, defaultLabels: string[]) => {
  opts.avg = settings.showAverage;
  opts.quantiles = settings.showQuantiles;
  let byLabels = defaultLabels;
  if (settings.labelsSettings.size > 0) {
    // Labels have been fetched, so use what comes from labelsSettings
    byLabels = [];
    settings.labelsSettings.forEach((objLbl, k) => {
      if (objLbl.checked) {
        byLabels.push(k);
      }
    });
  }
  opts.byLabels = byLabels;
};

export const timeRangeToOptions = (range: TimeRange, opts: MetricsQuery) => {
  delete opts.queryTime;
  opts.duration = guardTimeRange(
    range,
    d => d,
    ft => {
      opts.queryTime = ft.to && Math.floor(ft.to / 1000);
      return boundsToDuration(ft);
    }
  );
  const intervalOpts = computePrometheusRateParams(opts.duration);
  opts.step = intervalOpts.step;
  opts.rateInterval = intervalOpts.rateInterval;
};

export const retrieveMetricsSettings = (): MetricsSettings => {
  const urlParams = new URLSearchParams(history.location.search);
  const settings: MetricsSettings = {
    showAverage: true,
    showQuantiles: ['0.5', '0.99'],
    labelsSettings: new Map()
  };
  const avg = urlParams.get(URLParam.SHOW_AVERAGE);
  if (avg !== null) {
    settings.showAverage = avg === 'true';
  }
  const quantiles = urlParams.get(URLParam.QUANTILES);
  if (quantiles !== null) {
    if (quantiles.trim().length !== 0) {
      settings.showQuantiles = quantiles.split(' ').map(val => val.trim() as Quantiles);
    } else {
      settings.showQuantiles = [];
    }
  }
  const byLabels = urlParams.getAll(URLParam.BY_LABELS);
  // E.g.: bylbl=version=v1,v2,v4
  if (byLabels.length !== 0) {
    byLabels.forEach(val => {
      const kvpair = val.split('=', 2);
      const lblObj: LabelSettings = {
        displayName: '',
        checked: true,
        values: {},
        defaultValue: true
      };
      if (kvpair[1]) {
        kvpair[1].split(',').forEach(v => {
          lblObj.values[v] = true;
        });
        // When values filters are provided by URL, other filters should be false by default
        lblObj.defaultValue = false;
      }
      settings.labelsSettings.set(kvpair[0], lblObj);
    });
  }
  return settings;
};

export const prettyLabelValues = (promName: PromLabel, val: string): string => {
  if (promName === 'response_flags') {
    if (val === '-') {
      return 'None';
    }
    const flagObj = responseFlags[val];
    if (flagObj) {
      const text = flagObj.short ? flagObj.short : flagObj.help;
      return `${text} (${val})`;
    }
  }
  return val;
};
