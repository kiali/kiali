import * as React from 'react';
import { ChartLine, ChartThemeColor, getTheme } from '@patternfly/react-charts/victory';
import {
  Button,
  ButtonVariant,
  MenuToggle,
  Popover,
  PopoverPosition,
  Select,
  SelectList,
  SelectOption,
  Title,
  TitleSizes,
  TooltipPosition
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import { ChartWithLegend } from 'components/Charts/ChartWithLegend';
import { maximizeButtonStyle } from 'components/Charts/KChart';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import * as MetricsHelper from 'components/Metrics/Helper';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
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
import type { Aggregator, DashboardQuery } from 'types/MetricsOptions';
import type { Overlay } from 'types/Overlay';
import type { LineInfo, RichDataPoint, VCDataPoint, VCLines } from 'types/VictoryChartInfo';
import type { Workload } from 'types/Workload';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { t } from 'utils/I18nUtils';
import { getDataSupplier, toOverlay, toVCLine, toVCLines } from 'utils/VictoryChartsUtils';
import { sortedEnvoyPodNames } from 'utils/EnvoyMemoryUtils';
import { ResizeHeightObserver } from 'utils/ResizeHeightObserver';
import { flexFillStyle, noShrinkStyle } from 'styles/FlexStyles';
import { classes } from 'typestyle';

type EnvoyMemoryOverlayChartProps = {
  isMaximized: boolean;
  lastRefreshAt: TimeInMilliseconds;
  memoryLimitBytes?: number;
  namespace: string;
  onToggleMaximized: () => void;
  timeRange: TimeRange;
  workload: Workload;
};

type ChartViewMode = 'max' | 'sum';

const DEFAULT_CHART_HEIGHT = 300;
const MIN_MAXIMIZED_CHART_HEIGHT = 200;

const rootStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '100%',
  minHeight: 0,
  minWidth: 0,
  overflow: 'visible'
});

const chartHostStyle = kialiStyle({
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'visible',
  width: '100%'
});

const chartWrapStyle = kialiStyle({
  marginTop: PFSpacer.md,
  maxWidth: '100%',
  minHeight: '280px',
  minWidth: 0,
  overflow: 'visible',
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md
});

const maximizedChartWrapStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  marginTop: PFSpacer.md,
  maxWidth: '100%',
  minHeight: 0,
  minWidth: 0,
  overflow: 'visible',
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md
});

const titleRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md
});

const titleContentStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  minWidth: 0
});

const toolbarStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.md,
  marginTop: PFSpacer.sm,
  paddingBottom: PFSpacer.lg,
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md
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

// Include pod in series names so each pod appears as its own legend entry.
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

const filterMetricsByPods = (metrics: Metric[], selectedPods: string[], allPods: string[]): Metric[] => {
  if (allPods.length === 0 || selectedPods.length === 0 || selectedPods.length === allPods.length) {
    return metrics;
  }
  const selected = new Set(selectedPods);
  return metrics.filter(metric => {
    const pod = metric.labels?.pod;
    return !!pod && selected.has(pod);
  });
};

const samePodSelection = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  const setA = new Set(a);
  return b.every(pod => setA.has(pod));
};

type PodMultiSelectProps = {
  allPods: string[];
  onChange: (pods: string[]) => void;
  selectedPods: string[];
};

const PodMultiSelect: React.FC<PodMultiSelectProps> = ({ allPods, onChange, selectedPods }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const allSelected = selectedPods.length === allPods.length && allPods.length > 0;
  const label = allSelected
    ? t('All pods')
    : selectedPods.length === 0
      ? t('No pods')
      : selectedPods.length === 1
        ? selectedPods[0]
        : t('{{count}} pods', { count: selectedPods.length });

  const handleSelect = (_event?: React.MouseEvent | undefined, value?: string | number): void => {
    const key = String(value ?? '');
    if (key === 'all') {
      onChange([...allPods]);
      return;
    }

    if (selectedPods.includes(key)) {
      onChange(selectedPods.filter(pod => pod !== key));
    } else {
      onChange([...selectedPods, key].sort((a, b) => (a >= b ? 1 : -1)));
    }
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>): React.ReactNode => (
    <MenuToggle
      id="envoy-memory-chart-pod-toggle"
      ref={toggleRef}
      onClick={() => setIsOpen(!isOpen)}
      isExpanded={isOpen}
      aria-label={label}
    >
      {label}
    </MenuToggle>
  );

  return (
    <>
      <PFBadge badge={PFBadges.Pod} position={TooltipPosition.top} />
      <Select
        id="envoy-memory-chart-pod"
        data-test="envoy-memory-chart-pod"
        isOpen={isOpen}
        selected={selectedPods}
        onSelect={handleSelect}
        onOpenChange={setIsOpen}
        toggle={toggle}
      >
        <SelectList isAriaMultiselectable>
          <SelectOption hasCheckbox isSelected={allSelected} value="all">
            {t('All pods')}
          </SelectOption>
          {allPods.map(pod => (
            <SelectOption key={pod} hasCheckbox isSelected={selectedPods.includes(pod)} value={pod}>
              {pod}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </>
  );
};

export const EnvoyMemoryOverlayChart: React.FC<EnvoyMemoryOverlayChartProps> = (
  props: EnvoyMemoryOverlayChartProps
) => {
  const [dashboard, setDashboard] = React.useState<DashboardModel>();
  const [viewMode, setViewMode] = React.useState<ChartViewMode>('max');
  const [selectedPods, setSelectedPods] = React.useState<string[]>([]);
  const [measuredHeight, setMeasuredHeight] = React.useState(0);
  const chartWrapRef = React.useRef<HTMLDivElement>(null);
  const heightObserver = React.useRef<ResizeHeightObserver | null>(null);
  const appLabelName = getAppLabelName(props.workload.labels);
  const verLabelName = getVersionLabelName(props.workload.labels);
  const app = appLabelName ? props.workload.labels[appLabelName] : '';
  const version = verLabelName ? props.workload.labels[verLabelName] : undefined;
  const chartTitle = t('Memory vs active connections');
  const connectionsSeriesName = t('Active Connections');
  const podNames = React.useMemo(() => sortedEnvoyPodNames(props.workload), [props.workload.pods]);
  const podNamesKey = podNames.join('|');
  const viewModeOptions: { [key in ChartViewMode]: string } = {
    max: t('Max'),
    sum: t('Sum')
  };
  const needsPerPodSeries = podNames.length > 1;
  const chartHeight = props.isMaximized ? Math.max(measuredHeight, MIN_MAXIMIZED_CHART_HEIGHT) : DEFAULT_CHART_HEIGHT;

  React.useEffect(() => {
    const names = podNamesKey ? podNamesKey.split('|') : [];
    setSelectedPods(prev => {
      if (names.length === 0) {
        return [];
      }
      if (prev.length === 0) {
        return names;
      }
      const next = prev.filter(pod => names.includes(pod));
      if (next.length === 0) {
        return names;
      }
      return samePodSelection(prev, next) ? prev : next;
    });
  }, [podNamesKey]);

  React.useEffect(() => {
    if (!props.isMaximized) {
      heightObserver.current?.unobserve();
      setMeasuredHeight(0);
      return;
    }

    const el = chartWrapRef.current;
    if (!el) {
      return;
    }

    if (!heightObserver.current) {
      heightObserver.current = new ResizeHeightObserver(setMeasuredHeight, 2, MIN_MAXIMIZED_CHART_HEIGHT);
    }
    heightObserver.current.observe(el);

    return () => {
      heightObserver.current?.unobserve();
    };
  }, [props.isMaximized]);

  const fetchDashboard = React.useCallback((): void => {
    const filters = app && appLabelName ? `${appLabelName}:${app}` : '';
    const options: DashboardQuery = version
      ? { labelsFilters: `${filters},${verLabelName}:${version}` }
      : { labelsFilters: filters };

    MetricsHelper.timeRangeToOptions(props.timeRange, options);
    options.workload = props.workload.name;
    options.workloadType = props.workload.gvk.Kind;

    // Multi-pod workloads: fetch per-pod series; Max/Sum choose the Prometheus aggregator (legend stays one line per pod).
    options.rawDataAggregator = (viewMode === 'sum' ? 'sum' : 'max') as Aggregator;
    options.byLabels = needsPerPodSeries ? ['pod'] : [];

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
    needsPerPodSeries,
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
    let metrics = filterMetricsByPods(memoryChart.metrics, selectedPods, podNames);
    const showPodLegend = needsPerPodSeries || metrics.some(metric => !!metric.labels?.pod);
    if (showPodLegend) {
      metrics = metricsWithPodNames(metrics);
      memoryLines = toVCLines(metrics, memoryChart.unit, colorScale, memoryChart.xAxis || 'time');
    } else {
      memoryLines = getDataSupplier({ ...memoryChart, metrics }, { values: new Map() }, colorScale)();
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
          'Max and Sum choose how Prometheus aggregates samples when grouping by pod. The chart always shows one legend line per pod (filtered by the pod selector). Active Connections remain a workload total on the right axis.'
        )}
      </p>
    </>
  );

  return (
    <div
      className={classes(rootStyle, props.isMaximized ? flexFillStyle : undefined)}
      data-test="envoy-memory-overlay-chart"
    >
      <div className={classes(titleRowStyle, noShrinkStyle)}>
        <Title headingLevel="h4" size={TitleSizes.md}>
          <span className={titleContentStyle}>
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
        <div style={maximizeButtonStyle}>
          <Button
            aria-label={props.isMaximized ? t('Minimize chart') : t('Maximize chart')}
            data-test="envoy-memory-chart-expand"
            isInline
            onClick={props.onToggleMaximized}
            variant={ButtonVariant.link}
          >
            {props.isMaximized ? <KialiIcon.Compress /> : <KialiIcon.Expand />}
          </Button>
        </div>
      </div>
      <div className={classes(toolbarStyle, noShrinkStyle)} data-test="envoy-memory-chart-view-mode">
        <ToolbarDropdown
          id="envoy-memory-chart-view-mode"
          handleSelect={key => setViewMode(key as ChartViewMode)}
          nameDropdown={t('Pod Aggregation')}
          value={viewMode}
          label={viewModeOptions[viewMode]}
          options={viewModeOptions}
        />
        {podNames.length > 0 && (
          <PodMultiSelect allPods={podNames} onChange={setSelectedPods} selectedPods={selectedPods} />
        )}
      </div>
      <div className={props.isMaximized ? maximizedChartWrapStyle : chartWrapStyle} ref={chartWrapRef}>
        {memoryLines.length > 0 ? (
          <div className={chartHostStyle} data-test="metrics-chart">
            <ChartWithLegend<RichDataPoint, LineInfo>
              chartHeight={chartHeight}
              data={memoryLines}
              fill={false}
              isMaximized={props.isMaximized}
              overlay={connectionsOverlay}
              overlayAsLine={true}
              overlayRightPadding={54}
              paddingLeft={42}
              seriesComponent={<ChartLine />}
              showSpans={false}
              splitLegend={true}
              stroke={true}
              thresholds={memoryLimitThresholds}
              timeWindow={timeWindow}
              unit="bytes"
            />
          </div>
        ) : (
          <div>{dashboard ? t('No data available') : t('Loading metrics')}</div>
        )}
      </div>
    </div>
  );
};
