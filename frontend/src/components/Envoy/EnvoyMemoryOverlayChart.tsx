import * as React from 'react';
import { ChartLine, ChartThemeColor, getTheme } from '@patternfly/react-charts/victory';
import {
  Popover,
  PopoverPosition,
  Title,
  TitleSizes,
  Toolbar,
  ToolbarGroup,
  ToolbarItem
} from '@patternfly/react-core';
import { ChartWithLegend } from 'components/Charts/ChartWithLegend';
import * as MetricsHelper from 'components/Metrics/Helper';
import { MetricsSettingsDropdown } from 'components/MetricsOptions/MetricsSettingsDropdown';
import type { LabelsSettings, MetricsSettings } from 'components/MetricsOptions/MetricsSettings';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { getAppLabelName, getVersionLabelName } from 'config/ServerConfig';
import { helpIconStyle } from 'styles/IconStyle';
import { kialiStyle } from 'styles/StyleUtils';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import { evalTimeRange } from 'types/Common';
import type { ChartModel, DashboardModel } from 'types/Dashboards';
import type { DashboardQuery } from 'types/MetricsOptions';
import type { Metric } from 'types/Metrics';
import type { LineInfo, RichDataPoint, VCLine, VCLines } from 'types/VictoryChartInfo';
import type { Workload } from 'types/Workload';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { t } from 'utils/I18nUtils';
import { toVCLine } from 'utils/VictoryChartsUtils';

type EnvoyMemoryOverlayChartProps = {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  timeRange: TimeRange;
  workload: Workload;
};

type NamedSeries = {
  line: VCLine<RichDataPoint>;
  name: string;
  unit: string;
};

const SERIES_LABEL = 'metrics';

const COLOR_SCALE = (getTheme(ChartThemeColor.multi).chart?.colorScale ?? [PFColors.Blue400]) as string[];

const chartWrapStyle = kialiStyle({
  marginTop: '1.25rem',
  minHeight: '200px'
});

const titleRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex'
});

const headerRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  justifyContent: 'space-between'
});

const helpBodyStyle = kialiStyle({
  maxWidth: '22rem',
  textAlign: 'left'
});

const findChart = (dashboard: DashboardModel | undefined, name: string): ChartModel | undefined => {
  return dashboard?.charts.find(chart => chart.name === name);
};

const maxY = (line: VCLine<RichDataPoint>): number => {
  return line.datapoints.reduce((max, dp) => Math.max(max, Number(dp.y) || 0), 0);
};

const scaleLineToAxis = (line: VCLine<RichDataPoint>, unit: string, axisMax: number): VCLine<RichDataPoint> => {
  const seriesMax = maxY(line);
  const factor = seriesMax > 0 && axisMax > 0 ? axisMax / seriesMax : 1;

  return {
    ...line,
    datapoints: line.datapoints.map(dp => ({
      ...dp,
      unit,
      scaleFactor: factor,
      y: Number(dp.y) * factor
    }))
  };
};

const metricsWithoutReporter = (metrics: Metric[]): Metric[] => {
  return metrics.map(metric => {
    if (!metric.labels?.reporter) {
      return metric;
    }

    const labels = { ...metric.labels };
    delete labels.reporter;
    return { ...metric, labels };
  });
};

const buildSeriesFromMetrics = (
  metrics: Metric[],
  unit: string,
  colors: string[],
  colorOffset: number
): NamedSeries[] => {
  return metricsWithoutReporter(metrics).map((metric, idx) => {
    const color = colors[(colorOffset + idx) % colors.length];
    return {
      name: metric.name,
      unit,
      line: toVCLine(metric.datapoints, metric.name, color)
    };
  });
};

const buildLabelsSettings = (seriesNames: string[], previous?: LabelsSettings): LabelsSettings => {
  const previousValues = previous?.get(SERIES_LABEL)?.values ?? {};
  const values: { [key: string]: boolean } = {};
  seriesNames.forEach(name => {
    values[name] = previousValues[name] ?? true;
  });

  return new Map([
    [
      SERIES_LABEL,
      {
        checked: previous?.get(SERIES_LABEL)?.checked ?? true,
        defaultValue: true,
        displayName: t('Metrics'),
        singleSelection: false,
        values
      }
    ]
  ]);
};

const sameSeriesNames = (previous: LabelsSettings, names: string[]): boolean => {
  const current = previous.get(SERIES_LABEL);
  if (!current) {
    return names.length === 0;
  }
  const prevNames = Object.keys(current.values).sort();
  const nextNames = [...names].sort();
  return prevNames.length === nextNames.length && prevNames.every((name, idx) => name === nextNames[idx]);
};

export const EnvoyMemoryOverlayChart: React.FC<EnvoyMemoryOverlayChartProps> = (
  props: EnvoyMemoryOverlayChartProps
) => {
  const [dashboard, setDashboard] = React.useState<DashboardModel>();
  const [labelsSettings, setLabelsSettings] = React.useState<LabelsSettings>(new Map());
  const appLabelName = getAppLabelName(props.workload.labels);
  const verLabelName = getVersionLabelName(props.workload.labels);
  const app = appLabelName ? props.workload.labels[appLabelName] : '';
  const version = verLabelName ? props.workload.labels[verLabelName] : undefined;
  const chartTitle = t('Memory trends');

  const fetchDashboard = React.useCallback((): void => {
    const filters = app && appLabelName ? `${appLabelName}:${app}` : '';
    const options: DashboardQuery = version
      ? { labelsFilters: `${filters},${verLabelName}:${version}` }
      : { labelsFilters: filters };

    MetricsHelper.timeRangeToOptions(props.timeRange, options);
    options.workload = props.workload.name;
    options.workloadType = props.workload.gvk.Kind;

    if (!options.queryTime) {
      options.queryTime = Math.floor(props.lastRefreshAt / 1000);
    }

    API.getCustomDashboard(props.namespace, 'envoy-memory', options, props.workload.cluster)
      .then(response => {
        setDashboard(response.data);
      })
      .catch(error => {
        addError('Could not fetch Envoy memory charts.', error);
      });
  }, [
    app,
    appLabelName,
    props.lastRefreshAt,
    props.namespace,
    props.timeRange,
    props.workload.cluster,
    props.workload.gvk.Kind,
    props.workload.name,
    verLabelName,
    version
  ]);

  React.useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const memoryChart =
    findChart(dashboard, 'Memory trends') ??
    findChart(dashboard, 'Metrics correlation') ??
    findChart(dashboard, 'Allocated memory');
  const clustersChart = findChart(dashboard, 'Active clusters');
  const requestRateChart = findChart(dashboard, 'Request rate');

  const allSeries = React.useMemo((): NamedSeries[] => {
    const series: NamedSeries[] = [];
    let colorOffset = 0;

    if (memoryChart?.metrics?.length) {
      const memorySeries = buildSeriesFromMetrics(memoryChart.metrics, 'bytes', COLOR_SCALE, colorOffset);
      series.push(...memorySeries);
      colorOffset += memorySeries.length;
    }

    if (clustersChart?.metrics?.length) {
      const name = t('Active clusters');
      const color = COLOR_SCALE[colorOffset % COLOR_SCALE.length];
      const datapoints = clustersChart.metrics[0]?.datapoints ?? [];
      series.push({
        name,
        unit: '',
        line: toVCLine(datapoints, name, color)
      });
      colorOffset += 1;
    }

    if (requestRateChart?.metrics?.length) {
      metricsWithoutReporter(requestRateChart.metrics).forEach((metric, idx) => {
        const name = metric.name;
        const color = COLOR_SCALE[(colorOffset + idx) % COLOR_SCALE.length];
        series.push({
          name,
          unit: 'rps',
          line: toVCLine(metric.datapoints, name, color)
        });
      });
    }

    return series;
  }, [clustersChart, memoryChart, requestRateChart]);

  const seriesNamesKey = allSeries.map(s => s.name).join('|');

  React.useEffect(() => {
    if (!seriesNamesKey) {
      return;
    }
    const names = seriesNamesKey.split('|');
    setLabelsSettings(prev => {
      if (sameSeriesNames(prev, names)) {
        return prev;
      }
      return buildLabelsSettings(names, prev);
    });
  }, [seriesNamesKey]);

  const visibleSeries: VCLines<RichDataPoint> = React.useMemo(() => {
    const selected = labelsSettings.get(SERIES_LABEL);
    if (!selected?.checked) {
      return [];
    }

    const visible = allSeries.filter(s => selected.values[s.name] !== false);
    if (visible.length === 0) {
      return [];
    }

    const memoryMax = visible.filter(s => s.unit === 'bytes').reduce((max, s) => Math.max(max, maxY(s.line)), 0);
    const axisMax = memoryMax > 0 ? memoryMax : visible.reduce((max, s) => Math.max(max, maxY(s.line)), 0);

    return visible.map(s => {
      if (s.unit === 'bytes') {
        return {
          ...s.line,
          datapoints: s.line.datapoints.map(dp => ({ ...dp, unit: 'bytes', scaleFactor: 1 }))
        };
      }
      return scaleLineToAxis(s.line, s.unit || '', axisMax);
    });
  }, [allSeries, labelsSettings]);

  const onMetricsSettingsChanged = React.useCallback((settings: MetricsSettings): void => {
    setLabelsSettings(new Map(settings.labelsSettings));
  }, []);

  const onLabelsFiltersChanged = React.useCallback((settings: LabelsSettings): void => {
    setLabelsSettings(new Map(settings));
  }, []);

  const timeWindow = evalTimeRange(props.timeRange) as [Date, Date];
  const chartHelp = React.useMemo(
    () => (
      <>
        <p>
          {t(
            'Compare memory, active clusters and request rate over time. Toggle series in Metrics settings. Correlated rises often point to traffic-driven memory; high memory with low request rate can indicate large configuration.'
          )}
        </p>
        <p>
          {t(
            'Series: envoy_server_memory_allocated, container_memory_working_set_bytes (istio-proxy), envoy_cluster_manager_active_clusters, and istio_requests_total (Upstream = source|waypoint, Downstream = destination). Non-byte series are scaled to the memory axis for comparison; tooltips show real values.'
          )}
        </p>
      </>
    ),
    []
  );

  return (
    <div data-test="envoy-memory-overlay-chart">
      <div className={headerRowStyle}>
        <Title headingLevel="h4" size={TitleSizes.md}>
          <span className={titleRowStyle}>
            {chartTitle}
            <Popover
              aria-label={t('{{label}} information', { label: chartTitle })}
              bodyContent={<div className={helpBodyStyle}>{chartHelp}</div>}
              headerContent={<span>{chartTitle}</span>}
              position={PopoverPosition.top}
              triggerAction="hover"
            >
              <KialiIcon.Help className={helpIconStyle} />
            </Popover>
          </span>
        </Title>
        {labelsSettings.size > 0 && (
          <Toolbar style={{ padding: 0 }}>
            <ToolbarGroup>
              <ToolbarItem>
                <MetricsSettingsDropdown
                  direction={chartTitle}
                  hasHistograms={false}
                  hasHistogramsAverage={false}
                  hasHistogramsPercentiles={false}
                  labelsSettings={labelsSettings}
                  onChanged={onMetricsSettingsChanged}
                  onLabelsFiltersChanged={onLabelsFiltersChanged}
                />
              </ToolbarItem>
            </ToolbarGroup>
          </Toolbar>
        )}
      </div>
      <div className={chartWrapStyle}>
        {visibleSeries.length > 0 ? (
          <ChartWithLegend<RichDataPoint, LineInfo>
            chartHeight={220}
            data={visibleSeries}
            fill={false}
            seriesComponent={<ChartLine />}
            showSpans={false}
            stroke={true}
            timeWindow={timeWindow}
            unit="bytes"
          />
        ) : (
          <div>{dashboard ? t('No data available') : t('Loading metrics')}</div>
        )}
      </div>
    </div>
  );
};
