import * as React from 'react';
import { ChartLine, ChartThemeColor, getTheme } from '@patternfly/react-charts/victory';
import { Popover, PopoverPosition, Title, TitleSizes } from '@patternfly/react-core';
import { ChartWithLegend } from 'components/Charts/ChartWithLegend';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import * as MetricsHelper from 'components/Metrics/Helper';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { getAppLabelName, getVersionLabelName } from 'config/ServerConfig';
import { helpIconStyle } from 'styles/IconStyle';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import { evalTimeRange } from 'types/Common';
import type { ChartModel, DashboardModel } from 'types/Dashboards';
import type { Datapoint, Metric } from 'types/Metrics';
import type { DashboardQuery } from 'types/MetricsOptions';
import type { Overlay } from 'types/Overlay';
import type { LineInfo, RichDataPoint, VCDataPoint, VCLines } from 'types/VictoryChartInfo';
import type { Workload } from 'types/Workload';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { t } from 'utils/I18nUtils';
import { getDataSupplier, toOverlay, toVCLine, toVCLines } from 'utils/VictoryChartsUtils';

type EnvoyMemoryOverlayChartProps = {
  lastRefreshAt: TimeInMilliseconds;
  memoryLimitBytes?: number;
  namespace: string;
  timeRange: TimeRange;
  workload: Workload;
};

type ChartViewMode = 'max' | 'byPod';

const chartWrapStyle = kialiStyle({
  marginTop: PFSpacer.md,
  minHeight: '160px'
});

const titleRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex'
});

const toolbarStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.md,
  marginTop: PFSpacer.sm,
  paddingBottom: PFSpacer.lg
});

const helpBodyStyle = kialiStyle({
  maxWidth: '22rem',
  textAlign: 'left'
});

const findChart = (dashboard: DashboardModel | undefined, name: string): ChartModel | undefined => {
  return dashboard?.charts.find(chart => chart.name === name);
};

const seriesName = (line: { datapoints: VCDataPoint[]; legendItem?: { name?: string } }): string =>
  line.legendItem?.name ?? line.datapoints[0]?.name ?? '';

const activeConnectionsDatapoints = (
  lines: { datapoints: VCDataPoint[]; legendItem?: { name?: string } }[],
  name: string
): VCDataPoint[] => {
  const opened = lines.filter(line => /opened/i.test(seriesName(line)));
  const closed = lines.filter(line => /closed/i.test(seriesName(line)));
  const openedByTime = new Map<number, number>();
  const closedByTime = new Map<number, number>();

  opened.forEach(line => {
    line.datapoints.forEach(dp => {
      const key = Number(dp.x);
      openedByTime.set(key, (openedByTime.get(key) ?? 0) + dp.y);
    });
  });
  closed.forEach(line => {
    line.datapoints.forEach(dp => {
      const key = Number(dp.x);
      closedByTime.set(key, (closedByTime.get(key) ?? 0) + dp.y);
    });
  });

  // Prefer timestamps present in either series; missing side counts as 0 so card/chart stay aligned.
  const times = new Set<number>([...openedByTime.keys(), ...closedByTime.keys()]);
  return Array.from(times)
    .sort((a, b) => a - b)
    .map(x => {
      const active = (openedByTime.get(x) ?? 0) - (closedByTime.get(x) ?? 0);
      return { name, x: new Date(x), y: active > 0 ? active : 0 };
    });
};

// Always include the pod label in series names when viewing by pod (even if there is only one pod).
const metricsWithPodNames = (metrics: Metric[]): Metric[] =>
  metrics.map(metric => {
    const pod = metric.labels?.pod;
    if (!pod) {
      return metric;
    }
    return {
      ...metric,
      name: `${metric.name} [${pod}]`
    };
  });

export const EnvoyMemoryOverlayChart: React.FC<EnvoyMemoryOverlayChartProps> = (
  props: EnvoyMemoryOverlayChartProps
) => {
  const [dashboard, setDashboard] = React.useState<DashboardModel>();
  const [viewMode, setViewMode] = React.useState<ChartViewMode>('max');
  const appLabelName = getAppLabelName(props.workload.labels);
  const verLabelName = getVersionLabelName(props.workload.labels);
  const app = appLabelName ? props.workload.labels[appLabelName] : '';
  const version = verLabelName ? props.workload.labels[verLabelName] : undefined;
  const chartTitle = t('Memory vs active connections');
  const connectionsSeriesName = t('Active connections');
  const viewModeOptions: { [key in ChartViewMode]: string } = {
    max: t('Max'),
    byPod: t('By pod')
  };

  const fetchDashboard = React.useCallback((): void => {
    const filters = app && appLabelName ? `${appLabelName}:${app}` : '';
    const options: DashboardQuery = version
      ? { labelsFilters: `${filters},${verLabelName}:${version}` }
      : { labelsFilters: filters };

    MetricsHelper.timeRangeToOptions(props.timeRange, options);
    options.workload = props.workload.name;
    options.workloadType = props.workload.gvk.Kind;
    options.rawDataAggregator = 'max';
    options.byLabels = viewMode === 'byPod' ? ['pod'] : [];

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
    version,
    viewMode
  ]);

  React.useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const memoryChart =
    findChart(dashboard, 'Memory trends') ??
    findChart(dashboard, 'Allocated memory') ??
    findChart(dashboard, 'Metrics correlation');
  const connectionsChart = findChart(dashboard, 'Active connections');
  const colorScale = (getTheme(ChartThemeColor.multi).chart?.colorScale ?? [PFColors.Blue400]) as string[];

  let memoryLines: VCLines<RichDataPoint> = [];
  let connectionsOverlay: Overlay<LineInfo> | undefined;

  if (memoryChart) {
    if (viewMode === 'byPod') {
      memoryLines = toVCLines(metricsWithPodNames(memoryChart.metrics), memoryChart.unit, colorScale, 'time');
    } else {
      memoryLines = getDataSupplier(memoryChart, { values: new Map() }, colorScale)();
    }
  }

  if (connectionsChart) {
    const connectionLines = getDataSupplier(connectionsChart, { values: new Map() }, colorScale)();
    const active = activeConnectionsDatapoints(connectionLines, connectionsSeriesName);
    if (active.length > 0) {
      connectionsOverlay = toOverlay(
        {
          dataStyle: { stroke: PFColors.Orange400, strokeWidth: 2 },
          lineInfo: {
            color: PFColors.Orange400,
            name: connectionsSeriesName,
            unit: 'conn'
          }
        },
        active
      );
    }
  }

  const timeWindow = evalTimeRange(props.timeRange) as [Date, Date];
  const memoryLimitName = t('Memory limit');
  let memoryLimitThresholds: VCLines<RichDataPoint> = [];
  if ((props.memoryLimitBytes ?? 0) > 0) {
    const limitDps: Datapoint[] = [
      [timeWindow[0].getTime() / 1000, props.memoryLimitBytes!],
      [timeWindow[1].getTime() / 1000, props.memoryLimitBytes!]
    ];
    const limitLine = toVCLine(limitDps, memoryLimitName, PFColors.Danger);
    memoryLimitThresholds = [
      {
        ...limitLine,
        datapoints: limitLine.datapoints.map(dp => ({ ...dp, unit: 'bytes' }))
      }
    ];
  }

  const chartHelp = (
    <>
      <p>
        {t(
          'Compare allocated memory with active connections over time. Correlated rises often point to traffic-driven memory; high memory with low connections can indicate large configuration.'
        )}
      </p>
      <p>
        {t(
          "Left axis: Prometheus envoy_server_memory_allocated and container_memory_working_set_bytes (istio-proxy), scoped to this workload's pods. A Memory limit line appears when container_spec_memory_limit_bytes or sidecar.istio.io/proxyMemoryLimit is available. Right axis: active TCP approximated as sum(istio_tcp_connections_opened_total) - sum(istio_tcp_connections_closed_total)."
        )}
      </p>
      <p>
        {t(
          'Use Max to aggregate memory across pods (maximum), or By pod to plot each pod separately. Active connections remain a workload total on the right axis.'
        )}
      </p>
    </>
  );

  return (
    <div data-test="envoy-memory-overlay-chart">
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
      <div className={toolbarStyle} data-test="envoy-memory-chart-view-mode">
        <ToolbarDropdown
          id="envoy-memory-chart-view-mode"
          handleSelect={key => setViewMode(key as ChartViewMode)}
          nameDropdown={t('Series')}
          value={viewMode}
          label={viewModeOptions[viewMode]}
          options={viewModeOptions}
        />
      </div>
      <div className={chartWrapStyle}>
        {memoryLines.length > 0 ? (
          <ChartWithLegend<RichDataPoint, LineInfo>
            chartHeight={180}
            data={memoryLines}
            fill={false}
            overlay={connectionsOverlay}
            overlayAsLine={true}
            overlayRightPadding={48}
            seriesComponent={<ChartLine />}
            showSpans={false}
            splitLegend={true}
            stroke={true}
            thresholds={memoryLimitThresholds}
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
