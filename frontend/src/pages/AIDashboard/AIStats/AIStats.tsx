import * as React from 'react';
import { Card, CardBody, CardTitle, EmptyState, EmptyStateBody, Grid, GridItem } from '@patternfly/react-core';
import {
  AIUsageResponse,
  ChatSessionUsageBudget,
  formatCost,
  formatTokensInMillions,
  UsageValueKind
} from 'types/Chatbot';
import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartDonut,
  ChartGroup,
  ChartLine,
  ChartStack,
  ChartThreshold,
  ChartVoronoiContainer
} from '@patternfly/react-charts/victory';
import { getDonutDataBy, getLineChartData, getStackThresholdChartData } from './calculationData';
import { useKialiTranslation } from 'utils/I18nUtils';
import { AIKPI } from './AIKPI';
import { AIStatsHeader } from './AIStatsHeader';
import { DurationInSeconds } from 'types/Common';
import { PFSpacer } from 'styles/PfSpacer';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';

const chartsStyle = kialiStyle({
  marginTop: PFSpacer.md
});

const chartBoxStyle = kialiStyle({
  height: '300px',
  minWidth: 0,
  overflow: 'hidden',
  width: '100%'
});

const donutBoxStyle = kialiStyle({
  height: '220px',
  minWidth: 0,
  width: '100%'
});

/** Returns the pixel width of a container div, updated via ResizeObserver. */
const useContainerWidth = (ref: React.RefObject<HTMLDivElement | null>): number => {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const initial = ref.current.offsetWidth || Math.floor(ref.current.getBoundingClientRect().width);
    if (initial > 0) setWidth(initial);
    const observer = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

export type AIStatsProps = {
  budget?: ChatSessionUsageBudget | null;
  hideTimeRange?: boolean;
  onWindowChange?: (window: DurationInSeconds, step: DurationInSeconds) => void;
  summary: AIUsageResponse['summary'] | null;
  timeSeries: AIUsageResponse['timeSeries'] | null;
  window?: DurationInSeconds;
};

export const AIStats: React.FC<AIStatsProps> = ({
  budget = null,
  hideTimeRange = false,
  onWindowChange,
  summary,
  timeSeries,
  window = 86400
}) => {
  const { t } = useKialiTranslation();
  const donutRef = React.useRef<HTMLDivElement>(null);
  const lineRef = React.useRef<HTMLDivElement>(null);
  const stackRef = React.useRef<HTMLDivElement>(null);
  const donutWidth = useContainerWidth(donutRef) || 280;
  const lineWidth = useContainerWidth(lineRef) || 400;
  const stackWidth = useContainerWidth(stackRef) || 400;

  const [providersOptions, setProvidersOptions] = React.useState<string[]>(['All']);
  const [providerVisible, setProviderVisible] = React.useState<string>('All');
  const [valueKind, setValueKind] = React.useState<UsageValueKind>('tokens');

  React.useEffect(() => {
    const providers = (summary?.byProvider ?? []).map(p => p.provider).filter((p): p is string => !!p && p !== 'total');
    setProvidersOptions(['All', ...providers]);
    setProviderVisible('All');
  }, [summary]);

  const handleWindowChange = (newWindow: DurationInSeconds, newStep: DurationInSeconds) => {
    onWindowChange?.(newWindow, newStep);
  };

  const formatValue = (value: number): string =>
    valueKind === 'cost' ? formatCost(value) : formatTokensInMillions(value);

  const {
    colorScale: donutColorScale,
    data,
    legend,
    total
  } = React.useMemo(
    () => getDonutDataBy(summary, providerVisible, providersOptions, 'totalTokens', valueKind === 'cost'),
    [summary, valueKind, providerVisible, providersOptions]
  );

  const {
    colorScale: lineColorScale,
    legend: lineLegend,
    seriesData,
    xTickValues
  } = React.useMemo(
    () => getLineChartData(timeSeries, providerVisible, providersOptions, 'totalTokens', valueKind),
    [timeSeries, providerVisible, providersOptions, valueKind]
  );

  const thresholdY = valueKind === 'cost' ? (budget?.max_cost ?? 0) : (budget?.max_tokens ?? 0);
  const {
    colorScale: stackColorScale,
    legend: stackLegend,
    maxY: stackMaxY,
    seriesData: stackSeries,
    thresholdData,
    xTickValues: stackTicks
  } = React.useMemo(
    () =>
      getStackThresholdChartData(timeSeries, providerVisible, providersOptions, 'totalTokens', thresholdY, valueKind),
    [timeSeries, providerVisible, providersOptions, thresholdY, valueKind]
  );
  const stackLegendData = [...stackLegend, ...(thresholdData.length > 0 ? [{ name: t('Budget threshold') }] : [])];

  const hasProviderData = (summary?.byProvider ?? []).some(
    p => p.provider !== 'total' && (p.totalTokens > 0 || (p.cost?.total ?? 0) > 0)
  );

  if (!summary || !hasProviderData) {
    return (
      <EmptyState headingLevel="h4" titleText={t('No historical usage yet')}>
        <EmptyStateBody>{t('This view will populate after Chat AI usage is recorded for your user.')}</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div data-test="ai-user-metrics-charts">
      <Grid hasGutter className={chartsStyle}>
        <GridItem span={12}>
          <AIStatsHeader
            heading={
              hideTimeRange
                ? t(timeSeries?.window === 'monthly' ? 'Your monthly usage' : 'Your weekly usage')
                : t('Consumption of LLM')
            }
            hideTimeRange={hideTimeRange}
            onValueKindChange={setValueKind}
            onWindowChange={handleWindowChange}
            valueKind={valueKind}
            window={window}
          />
        </GridItem>
        <GridItem span={12} lg={8}>
          <AIKPI
            metric="totalTokens"
            onProviderChange={setProviderVisible}
            summary={summary ?? { byModel: [], byProvider: [] }}
            valueKind={valueKind}
          />
        </GridItem>
        <GridItem span={12} lg={4}>
          <Card isCompact>
            <CardTitle>{t('Usage by provider')}</CardTitle>
            <CardBody>
              <div className={donutBoxStyle} data-test="ai-usage-by-provider-chart" ref={donutRef}>
                {data.length > 0 && donutWidth > 0 && (
                  <ChartDonut
                    ariaTitle={t('Usage by provider')}
                    colorScale={donutColorScale}
                    constrainToVisibleArea
                    data={data}
                    height={200}
                    labels={({ datum }) => `${datum.x}: ${formatValue(datum.y)}`}
                    legendData={legend}
                    legendOrientation="vertical"
                    subTitle={valueKind === 'cost' ? t('Cost') : t('Tokens (M)')}
                    title={formatValue(total)}
                    width={donutWidth}
                  />
                )}
              </div>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={12} lg={6}>
          <Card isCompact data-test="ai-usage-line-chart">
            <CardTitle>{t('Usage over time')}</CardTitle>
            <CardBody>
              <div className={chartBoxStyle} ref={lineRef}>
                {seriesData.length > 0 && lineWidth > 0 && (
                  <Chart
                    ariaDesc={t('Usage over time')}
                    ariaTitle={t('Usage over time')}
                    colorScale={lineColorScale}
                    containerComponent={
                      <ChartVoronoiContainer
                        constrainToVisibleArea
                        labels={({ datum }) => (datum.y != null ? `${datum.name}: ${formatValue(datum.y)}` : '')}
                      />
                    }
                    height={250}
                    legendData={lineLegend}
                    legendOrientation="horizontal"
                    legendPosition="bottom"
                    padding={{ bottom: 80, left: 70, right: 30, top: 20 }}
                    width={lineWidth}
                  >
                    <ChartAxis
                      style={{ tickLabels: { angle: -30, fontSize: 8 } }}
                      tickFormat={(tick, i) => (i % Math.max(1, Math.floor(xTickValues.length / 8)) === 0 ? tick : '')}
                      tickValues={xTickValues}
                    />
                    <ChartAxis dependentAxis showGrid tickFormat={(tick: number) => formatValue(tick)} />
                    <ChartGroup>
                      {seriesData.map((points, i) => (
                        <ChartLine key={i} data={points} />
                      ))}
                    </ChartGroup>
                  </Chart>
                )}
              </div>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem span={12} lg={6}>
          <Card isCompact data-test="ai-weekly-budget-chart">
            <CardTitle>{t('Usage versus budget')}</CardTitle>
            <CardBody>
              <div className={chartBoxStyle} ref={stackRef}>
                {stackSeries.length > 0 && stackWidth > 0 && (
                  <Chart
                    ariaDesc={t('Usage versus budget')}
                    ariaTitle={t('Usage versus budget')}
                    colorScale={stackColorScale}
                    containerComponent={
                      <ChartVoronoiContainer
                        constrainToVisibleArea
                        labels={({ datum }) => (datum.y != null ? `${datum.name}: ${formatValue(datum.y)}` : '')}
                      />
                    }
                    height={250}
                    legendData={stackLegendData}
                    legendOrientation="horizontal"
                    legendPosition="bottom"
                    maxDomain={{ y: stackMaxY * 1.1 || 1 }}
                    padding={{ bottom: 80, left: 70, right: 30, top: 20 }}
                    width={stackWidth}
                  >
                    <ChartAxis style={{ tickLabels: { angle: -30, fontSize: 8 } }} tickValues={stackTicks} />
                    <ChartAxis dependentAxis showGrid tickFormat={(tick: number) => formatValue(tick)} />
                    <ChartStack>
                      {stackSeries.map((points, i) => (
                        <ChartBar key={i} data={points} />
                      ))}
                    </ChartStack>
                    {thresholdData.length > 0 && (
                      <ChartThreshold data={thresholdData} style={{ data: { stroke: PFColors.Danger } }} />
                    )}
                  </Chart>
                )}
              </div>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </div>
  );
};
