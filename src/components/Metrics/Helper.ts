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
import MetricsDuration from '../MetricsOptions/MetricsDuration';
import { DurationInSeconds } from '../../types/Common';
import { computePrometheusRateParams } from '../../services/Prometheus';
import history, { URLParam } from '../../app/History';
import responseFlags from 'utils/ResponseFlags';

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

export const extractLabelsSettings = (dashboard: DashboardModel): LabelsSettings => {
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
  dashboard.charts.forEach(chart => {
    if (chart.metric) {
      extractLabelsSettingsOnSeries(chart.metric, dashboard.aggregations, newSettings);
    }
    if (chart.histogram) {
      Object.keys(chart.histogram).forEach(stat => {
        extractLabelsSettingsOnSeries(chart.histogram![stat], dashboard.aggregations, newSettings);
      });
    }
  });
  return newSettings;
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

export const settingsToOptions = (settings: MetricsSettings, opts: MetricsQuery) => {
  opts.avg = settings.showAverage;
  opts.quantiles = settings.showQuantiles;
  opts.byLabels = [];
  settings.labelsSettings.forEach((objLbl, k) => {
    if (objLbl.checked) {
      opts.byLabels!.push(k);
    }
  });
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

export const readMetricsSettingsFromURL = (): MetricsSettings => {
  const urlParams = new URLSearchParams(history.location.search);
  const settings: MetricsSettings = {
    showAverage: true,
    showQuantiles: ['0.5', '0.95', '0.99'],
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
