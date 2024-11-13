import { MetricsSettings, LabelsSettings, Quantiles, LabelSettings } from '../MetricsOptions/MetricsSettings';
import { boundsToDuration, guardTimeRange, TimeRange, DurationInSeconds } from '../../types/Common';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { URLParam, location } from '../../app/History';
import { responseFlags } from 'utils/ResponseFlags';
import { AggregationModel, DashboardModel } from 'types/Dashboards';
import { AllPromLabelsValues, Metric, PromLabel, SingleLabelValues } from 'types/Metrics';
import { MetricsQuery } from 'types/MetricsOptions';
import { TRACE_LIMIT_DEFAULT } from './TraceLimit';

// Default to 10 minutes. Showing timeseries to only 1 minute doesn't make so much sense.
export const defaultMetricsDuration: DurationInSeconds = 600;

export const combineLabelsSettings = (newSettings: LabelsSettings, stateSettings: LabelsSettings): LabelsSettings => {
  // Labels: keep existing on/off flag
  // This is allowed because the labels filters state is managed only from this component,
  // so we can override them in props from state
  // LabelsSettings received from props contains the names of the filters with only a default on/off flag.
  const result: LabelsSettings = new Map();

  newSettings.forEach((lblObj, promLabel) => {
    const resultValues: SingleLabelValues = {};
    const stateObj = stateSettings.get(promLabel);

    Object.entries(lblObj.values).forEach(e => {
      resultValues[e[0]] = stateObj && stateObj.defaultValue === false ? false : e[1];
    });

    if (stateObj) {
      lblObj.checked = stateObj.checked;

      Object.entries(stateObj.values).forEach(e => {
        resultValues[e[0]] = e[1];
      });
    }

    result.set(promLabel, { ...lblObj, values: resultValues });
  });

  return result;
};

export const extractLabelsSettingsOnSeries = (
  metrics: Metric[],
  aggregations: AggregationModel[],
  extracted: LabelsSettings
): void => {
  metrics.forEach(m => {
    Object.keys(m.labels).forEach(k => {
      const agg = aggregations.find(a => a.label === k);

      if (agg) {
        const value = m.labels[k];
        let lblObj = extracted.get(agg.label);

        if (!lblObj) {
          lblObj = {
            checked: true,
            displayName: agg.displayName,
            values: {},
            defaultValue: true,
            singleSelection: agg.singleSelection
          };

          extracted.set(agg.label, lblObj);
        } else {
          lblObj.checked = true;
        }

        if (!lblObj.values.hasOwnProperty(value)) {
          if (agg.singleSelection && Object.keys(lblObj.values).length > 0) {
            // In single-selection mode, do not activate more than one label value at a time
            lblObj.values[value] = false;
          } else {
            lblObj.values[value] = true;
          }
        }
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
      defaultValue: true,
      singleSelection: agg.singleSelection
    })
  );

  dashboard.charts.forEach(chart => extractLabelsSettingsOnSeries(chart.metrics, dashboard.aggregations, newSettings));
  return combineLabelsSettings(newSettings, stateSettings);
};

export const mergeLabelFilter = (
  lblSettings: LabelsSettings,
  label: PromLabel,
  value: string,
  checked: boolean,
  singleSelection: boolean
): LabelsSettings => {
  // Note: we don't really care that the new map references same objects as the old one (at least at the moment) so shallow copy is fine
  const newSettings = new Map(lblSettings);
  const objLbl = newSettings.get(label);

  if (objLbl) {
    if (singleSelection) {
      for (const v of Object.keys(objLbl.values)) {
        objLbl.values[v] = false;
      }
    }

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

export const settingsToOptions = (settings: MetricsSettings, opts: MetricsQuery, defaultLabels: string[]): void => {
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

export const timeRangeToOptions = (range: TimeRange, opts: MetricsQuery): void => {
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

export const retrieveMetricsSettings = (limitDefault?: number): MetricsSettings => {
  const urlParams = new URLSearchParams(location.getSearch());

  const settings: MetricsSettings = {
    labelsSettings: new Map(),
    showAverage: true,
    showSpans: false,
    spanLimit: limitDefault ?? TRACE_LIMIT_DEFAULT,
    showQuantiles: [],
    showTrendlines: false
  };

  const avg = urlParams.get(URLParam.SHOW_AVERAGE);
  if (avg !== null) {
    settings.showAverage = avg === 'true';
  }

  const spans = urlParams.get(URLParam.SHOW_SPANS);
  if (spans !== null) {
    settings.showSpans = spans === 'true';
  }

  const spansLimit = urlParams.get(URLParam.TRACING_LIMIT_TRACES);
  if (spansLimit !== null) {
    settings.spanLimit = parseInt(spansLimit);
  }

  const trendlines = urlParams.get(URLParam.SHOW_TRENDLINES);
  if (trendlines !== null) {
    settings.showTrendlines = trendlines === 'true';
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
        defaultValue: true,
        singleSelection: false
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
