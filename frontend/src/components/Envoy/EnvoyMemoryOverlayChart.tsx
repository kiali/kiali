import * as React from 'react';
import { ChartLine, ChartThemeColor, getTheme } from '@patternfly/react-charts/victory';
import { Popover, PopoverPosition, Title, TitleSizes } from '@patternfly/react-core';
import { ChartWithLegend } from 'components/Charts/ChartWithLegend';
import * as MetricsHelper from 'components/Metrics/Helper';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { getAppLabelName, getVersionLabelName } from 'config/ServerConfig';
import { helpIconStyle } from 'styles/IconStyle';
import { kialiStyle } from 'styles/StyleUtils';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import { evalTimeRange } from 'types/Common';
import type { ChartModel, DashboardModel } from 'types/Dashboards';
import type { DashboardQuery } from 'types/MetricsOptions';
import type { Overlay } from 'types/Overlay';
import type { LineInfo, RichDataPoint, VCDataPoint, VCLines } from 'types/VictoryChartInfo';
import type { Workload } from 'types/Workload';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { t } from 'utils/I18nUtils';
import { getDataSupplier, toOverlay } from 'utils/VictoryChartsUtils';

type EnvoyMemoryOverlayChartProps = {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  timeRange: TimeRange;
  workload: Workload;
};

const chartWrapStyle = kialiStyle({
  marginTop: '1.25rem',
  minHeight: '160px'
});

const titleRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex'
});

const helpBodyStyle = kialiStyle({
  maxWidth: '22rem',
  textAlign: 'left'
});

const findChart = (dashboard: DashboardModel | undefined, name: string): ChartModel | undefined => {
  return dashboard?.charts.find(chart => chart.name === name);
};

const sumDatapoints = (lines: { datapoints: VCDataPoint[] }[]): VCDataPoint[] => {
  const byTime = new Map<number, number>();

  lines.forEach(line => {
    line.datapoints.forEach(dp => {
      const key = Number(dp.x);
      byTime.set(key, (byTime.get(key) ?? 0) + dp.y);
    });
  });

  return Array.from(byTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([x, y]) => ({ name: 'Active connections', x: new Date(x), y }));
};

export const EnvoyMemoryOverlayChart: React.FC<EnvoyMemoryOverlayChartProps> = (
  props: EnvoyMemoryOverlayChartProps
) => {
  const [dashboard, setDashboard] = React.useState<DashboardModel>();
  const appLabelName = getAppLabelName(props.workload.labels);
  const verLabelName = getVersionLabelName(props.workload.labels);
  const app = appLabelName ? props.workload.labels[appLabelName] : '';
  const version = verLabelName ? props.workload.labels[verLabelName] : undefined;
  const chartTitle = t('Memory vs active connections');

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

  const memoryChart = findChart(dashboard, 'Allocated memory');
  const connectionsChart = findChart(dashboard, 'Active connections');
  const colorScale = (getTheme(ChartThemeColor.multi).chart?.colorScale ?? [PFColors.Blue400]) as string[];

  let memoryLines: VCLines<RichDataPoint> = [];
  let connectionsOverlay: Overlay<LineInfo> | undefined;

  if (memoryChart) {
    memoryLines = getDataSupplier(memoryChart, { values: new Map() }, colorScale)();
  }

  if (connectionsChart) {
    const connectionLines = getDataSupplier(connectionsChart, { values: new Map() }, colorScale)();
    const summed = sumDatapoints(connectionLines);
    if (summed.length > 0) {
      connectionsOverlay = toOverlay(
        {
          dataStyle: { stroke: PFColors.Orange400, strokeWidth: 2 },
          lineInfo: {
            color: PFColors.Orange400,
            name: t('Active connections'),
            unit: 'conn'
          }
        },
        summed
      );
    }
  }

  const timeWindow = evalTimeRange(props.timeRange) as [Date, Date];
  const chartHelp = (
    <>
      <p>
        {t(
          'Compare allocated memory with active connections over time. Correlated rises often point to traffic-driven memory; high memory with low connections can indicate large configuration.'
        )}
      </p>
      <p>
        {t(
          'Left axis: Prometheus envoy_server_memory_allocated. Right axis: sum of envoy_cluster_upstream_cx_active and envoy_listener_downstream_cx_active over time.'
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
      <div className={chartWrapStyle}>
        {memoryLines.length > 0 ? (
          <ChartWithLegend<RichDataPoint, LineInfo>
            chartHeight={160}
            data={memoryLines}
            fill={false}
            overlay={connectionsOverlay}
            overlayRightPadding={48}
            seriesComponent={<ChartLine />}
            showSpans={true}
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
