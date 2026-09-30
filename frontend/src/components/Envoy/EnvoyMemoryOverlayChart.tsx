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
  TitleSizes
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import { ChartWithLegend } from 'components/Charts/ChartWithLegend';
import { maximizeButtonStyle } from 'components/Charts/KChart';
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

type ChartViewMode = 'max' | 'sum' | 'byPod';

const DEFAULT_CHART_HEIGHT = 300;
const MIN_MAXIMIZED_CHART_HEIGHT = 200;

const rootStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0
});

const chartWrapStyle = kialiStyle({
  marginTop: PFSpacer.md,
  minHeight: '280px',
  paddingLeft: PFSpacer.md,
  paddingRight: PFSpacer.md
});

const maximizedChartWrapStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  marginTop: PFSpacer.md,
  minHeight: 0,
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

const dropdownTitleStyle = kialiStyle({
  alignSelf: 'center',
  marginRight: '10px'
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

const filterMetricsByPods = (metrics: Metric[], selectedPods: string[], allPods: string[]): Metric[] => {
  if (allPods.length === 0 || selectedPods.length === allPods.length) {
    return metrics;
  }
  if (selectedPods.length === 0) {
    return [];
  }
  const selected = new Set(selectedPods);
  return metrics.filter(metric => {
    const pod = metric.labels?.pod;
    return !!pod && selected.has(pod);
  });
};

const aggregateMetricsByName = (metrics: Metric[], mode: 'max' | 'sum'): Metric[] => {
  const byName = new Map<string, Metric[]>();
  metrics.forEach(metric => {
    const list = byName.get(metric.name) ?? [];
    list.push(metric);
    byName.set(metric.name, list);
  });

  return Array.from(byName.entries()).map(([name, series]) => {
    const byTime = new Map<number, number[]>();
    series.forEach(metric => {
      metric.datapoints.forEach(([ts, val]) => {
        const values = byTime.get(ts) ?? [];
        values.push(val);
        byTime.set(ts, values);
      });
    });

    const datapoints: Datapoint[] = Array.from(byTime.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, values]) => [ts, mode === 'sum' ? values.reduce((acc, v) => acc + v, 0) : Math.max(...values)]);

    return { datapoints, labels: {}, name };
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
      onChange(allSelected ? [] : [...allPods]);
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
      <span id="envoy-memory-chart-pod-name" className={dropdownTitleStyle}>
        {t('Pod')}
      </span>
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
  const connectionsSeriesName = t('Active connections');
  const podNames = React.useMemo(() => sortedEnvoyPodNames(props.workload), [props.workload.pods]);
  const podNamesKey = podNames.join('|');
  const viewModeOptions: { [key in ChartViewMode]: string } = {
    max: t('Max'),
    sum: t('Sum'),
    byPod: t('By pod')
  };
  const allPodsSelected = podNames.length === 0 || selectedPods.length === podNames.length;
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

    // Fetch per-pod series when viewing by pod or when filtering to a subset of pods.
    const needsPerPod = viewMode === 'byPod' || !allPodsSelected;
    options.rawDataAggregator = (viewMode === 'sum' ? 'sum' : 'max') as Aggregator;
    options.byLabels = needsPerPod ? ['pod'] : [];

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
    allPodsSelected,
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
    let metrics = filterMetricsByPods(memoryChart.metrics, selectedPods, podNames);
    if (viewMode === 'byPod') {
      metrics = metricsWithPodNames(metrics);
      memoryLines = toVCLines(metrics, memoryChart.unit, colorScale, 'time');
    } else if (!allPodsSelected) {
      metrics = aggregateMetricsByName(metrics, viewMode);
      memoryLines = getDataSupplier({ ...memoryChart, metrics }, { values: new Map() }, colorScale)();
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
          'Use Max or Sum to aggregate memory across pods, or By pod to plot each pod separately. The pod selector filters one or more pods. Active connections remain a workload total on the right axis.'
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
          nameDropdown={t('Pod metrics')}
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
          <ChartWithLegend<RichDataPoint, LineInfo>
            chartHeight={chartHeight}
            data={memoryLines}
            fill={false}
            isMaximized={props.isMaximized}
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
