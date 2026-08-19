import * as React from 'react';
import { Bullseye, Divider, EmptyState, EmptyStateBody, Grid, GridItem, Spinner } from '@patternfly/react-core';
import * as API from 'services/Api';
import { AIUsageResponse, TokenMetric } from 'types/Chatbot';
import {
  Chart,
  ChartAxis,
  ChartBar,
  ChartDonut,
  ChartGroup,
  ChartLine,
  ChartStack,
  ChartVoronoiContainer
} from '@patternfly/react-charts/victory';
import { getConsumptionByTokenTypeData, getDonutDataBy, getLineChartData } from './calculationData';
import { TOKEN_METRIC_COLORS } from './colorPalette';

import { DurationInSeconds } from 'types/Common';
import { onAIResponseReceived } from 'utils/aiEvents';
import { useKialiTranslation } from 'utils/I18nUtils';
import { AIKPI } from './AIKPI';
import { AIStatsHeader } from './AIStatsHeader';

/** Returns the pixel width of a container div, updated via ResizeObserver. */
const useContainerWidth = (ref: React.RefObject<HTMLDivElement | null>): number => {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    // Read initial width immediately so charts render on the first paint
    // without waiting for the async ResizeObserver callback.
    // offsetWidth is more reliable than getBoundingClientRect in CSS Grid contexts.
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

export const AIStats: React.FC = () => {
  const { t } = useKialiTranslation();
  const donutRef = React.useRef<HTMLDivElement>(null);
  const lineRef = React.useRef<HTMLDivElement>(null);
  const consumptionByTokenTypeRef = React.useRef<HTMLDivElement>(null);
  const lineWidth = useContainerWidth(lineRef) || 800;
  const consumptionByTokenTypeWidth = useContainerWidth(consumptionByTokenTypeRef) || 400;

  const [summary, setSummary] = React.useState<AIUsageResponse['summary'] | null>(null);
  const [timeSeries, setTimeSeries] = React.useState<AIUsageResponse['timeSeries'] | null>(null);
  const [providersOptions, setProvidersOptions] = React.useState<string[]>([]);
  const [providerVisible, setProviderVisible] = React.useState<string>('All');
  const [tokenMetric, setTokenMetric] = React.useState<TokenMetric>('totalTokens');
  const [window, setWindow] = React.useState<DurationInSeconds>(86400);
  const [step, setStep] = React.useState<DurationInSeconds>(3600);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>('');

  const loadUsage = React.useCallback(
    async (windowSecs: DurationInSeconds, stepSecs: DurationInSeconds): Promise<void> => {
      setLoading(true);
      try {
        const response = await API.getAIUsage(windowSecs, stepSecs);
        const aiUsage: AIUsageResponse = response.data;
        setSummary(aiUsage.summary);
        setTimeSeries(aiUsage.timeSeries);
        setProvidersOptions([
          'All',
          ...(aiUsage.summary!.byProvider.map(p => p.provider!).filter(p => p !== undefined) as string[])
        ]);
        setError('');
      } catch (err) {
        setError(API.getErrorString(err as any));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    void loadUsage(window, step);
  }, [loadUsage, window, step]);

  // Refresh whenever the chatbot delivers a new response.
  React.useEffect(() => {
    return onAIResponseReceived(() => void loadUsage(window, step));
  }, [loadUsage, window, step]);

  const handleWindowChange = (newWindow: DurationInSeconds, newStep: DurationInSeconds) => {
    setWindow(newWindow);
    setStep(newStep);
  };

  const {
    colorScale: donutColorScale,
    data,
    legend,
    total
  } = React.useMemo(
    () => getDonutDataBy(summary, providerVisible, providersOptions, tokenMetric),
    [summary, tokenMetric, providerVisible, providersOptions]
  );

  const { data: dataConsumptionByTokenType, legend: legendConsumptionByTokenType } = React.useMemo(
    () =>
      getConsumptionByTokenTypeData(
        providerVisible === 'All'
          ? (summary?.byProvider.filter(p => p.provider !== 'total') ?? null)
          : (summary?.byModel ?? null),
        providerVisible,
        tokenMetric
      ),
    [summary, providerVisible, tokenMetric]
  );

  const {
    colorScale: lineColorScale,
    legend: lineLegend,
    seriesData,
    xTickValues
  } = React.useMemo(
    () => getLineChartData(timeSeries, providerVisible, providersOptions, tokenMetric),
    [timeSeries, providerVisible, providersOptions, tokenMetric]
  );

  const emptyState = (
    <EmptyState headingLevel="h4" titleText={t('No token stats yet')}>
      <EmptyStateBody>{t('This view will populate after you use Chat AI.')}</EmptyStateBody>
    </EmptyState>
  );

  const errorState = (
    <EmptyState headingLevel="h4" titleText={t('Unable to load token stats')}>
      <EmptyStateBody>{error}</EmptyStateBody>
    </EmptyState>
  );
  return (
    <div>
      <Divider component="div" />
      <Grid hasGutter style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        {loading ? (
          <Bullseye data-test="session-token-stats-loading">
            <Spinner size="xl" />
          </Bullseye>
        ) : error ? (
          errorState
        ) : summary && summary.byProvider.length === 0 ? (
          emptyState
        ) : (
          <>
            <GridItem span={12}>
              <AIStatsHeader
                window={window}
                onWindowChange={handleWindowChange}
                metric={tokenMetric}
                onMetricChange={m => setTokenMetric(m as TokenMetric)}
              />
            </GridItem>
            <GridItem span={12}>
              <AIKPI
                summary={summary ?? { byModel: [], byProvider: [] }}
                onProviderChange={setProviderVisible}
                metric={tokenMetric}
              />
            </GridItem>
            <GridItem span={4}>
              <div ref={donutRef} style={{ height: '200px', width: '275px' }}>
                {data.length > 0 && (
                  <ChartDonut
                    ariaTitle="Tokens Consumption by Provider"
                    data={data}
                    constrainToVisibleArea
                    legendData={legend}
                    legendOrientation="vertical"
                    height={180}
                    width={250}
                    subTitle="Tokens"
                    title={total.toLocaleString()}
                    colorScale={donutColorScale}
                    labels={({ datum }) => `${datum.x}: ${datum.y} tokens`}
                  />
                )}
              </div>
            </GridItem>
            <GridItem span={8}>
              <div ref={consumptionByTokenTypeRef} style={{ height: '200px', width: '1000px' }}>
                {consumptionByTokenTypeWidth > 0 && (dataConsumptionByTokenType ?? []).some(s => s.length > 0) && (
                  <Chart
                    ariaDesc="AI token usage by provider"
                    ariaTitle="Token usage by provider"
                    width={950}
                    height={200}
                    colorScale={[TOKEN_METRIC_COLORS.promptTokens, TOKEN_METRIC_COLORS.completionTokens]}
                    containerComponent={
                      <ChartVoronoiContainer
                        labels={({ datum }) =>
                          datum.y != null ? `${datum.x}: ${datum.y.toLocaleString()} tokens` : ''
                        }
                        constrainToVisibleArea
                      />
                    }
                    legendData={legendConsumptionByTokenType}
                    legendPosition="right"
                    legendOrientation="vertical"
                    padding={{ bottom: 80, left: 100, right: 160, top: 20 }}
                  >
                    <ChartAxis
                      tickValues={dataConsumptionByTokenType.map(s => s.map(d => d.name))}
                      fixLabelOverlap
                      style={{ tickLabels: { fontSize: 10 } }}
                    />
                    <ChartAxis dependentAxis showGrid />
                    <ChartStack>
                      {(dataConsumptionByTokenType ?? []).map((points, i) => (
                        <ChartBar key={i} data={points} />
                      ))}
                    </ChartStack>
                  </Chart>
                )}
              </div>
            </GridItem>
            <GridItem span={12}>
              <div ref={lineRef} style={{ height: '300px', minWidth: 0, overflow: 'hidden', width: '100%' }}>
                {seriesData.length > 0 && lineWidth > 0 && (
                  <Chart
                    ariaDesc="AI token usage over time"
                    ariaTitle="Token usage time series"
                    containerComponent={
                      <ChartVoronoiContainer
                        labels={({ datum }) =>
                          datum.y != null ? `${datum.name}: ${datum.y.toLocaleString()} tokens` : ''
                        }
                        constrainToVisibleArea
                      />
                    }
                    legendData={lineLegend}
                    legendOrientation="horizontal"
                    legendPosition="bottom"
                    height={250}
                    width={1500}
                    padding={{ bottom: 70, left: 60, right: 200, top: 20 }}
                    colorScale={lineColorScale}
                  >
                    <ChartAxis
                      tickValues={xTickValues}
                      tickFormat={(t, i) => (i % Math.max(1, Math.floor(xTickValues.length / 12)) === 0 ? t : '')}
                      style={{ tickLabels: { angle: -30, fontSize: 8 } }}
                    />
                    <ChartAxis dependentAxis showGrid />
                    <ChartGroup>
                      {seriesData.map((points, i) => (
                        <ChartLine key={i} data={points} />
                      ))}
                    </ChartGroup>
                  </Chart>
                )}
              </div>
            </GridItem>
          </>
        )}
      </Grid>
    </div>
  );
};
