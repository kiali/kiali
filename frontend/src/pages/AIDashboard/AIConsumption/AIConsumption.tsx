import * as React from 'react';
import { Bullseye, EmptyState, EmptyStateBody, Grid, GridItem, Spinner } from '@patternfly/react-core';
import * as API from 'services/Api';
import { formatTokensInMillions } from 'types/Chatbot';
import type { AIUsageResponse, UsageValueKind } from 'types/Chatbot';
import { Chart, ChartAxis, ChartBar, ChartStack, ChartVoronoiContainer } from '@patternfly/react-charts/victory';
import { getLineChartData } from '../AIStats/calculationData';
import { onAIResponseReceived } from 'utils/aiEvents';
import { useKialiTranslation } from 'utils/I18nUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { kialiStyle } from 'styles/StyleUtils';
import { AIConsumptionHeader } from './AIConsumptionHeader';
import { AIKPI } from '../AIStats/AIKPI';
import { AIConsumptionTables } from './AIConsumptionTables';

const chartBoxStyle = kialiStyle({
  boxSizing: 'border-box',
  height: '320px',
  marginLeft: 'auto',
  marginRight: 'auto',
  minWidth: 0,
  overflow: 'visible',
  paddingRight: PFSpacer.lg,
  width: '95%'
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

// We need a helper to format costs
const formatCost = (value: number, currency = 'USD'): string => {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
};

const getISOWeek = (date: Date): { week: number; year: number } => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
};

const getDefaultRange = (window: string): { fromVal: number; toVal: number } => {
  const now = new Date();
  if (window === 'weekly') {
    const to = new Date(now);
    const day = to.getDay();
    const diff = to.getDate() - day + (day === 0 ? -6 : 1);
    to.setDate(diff);
    to.setHours(0, 0, 0, 0);

    const from = new Date(to.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);
    return { fromVal: from.getTime(), toVal: to.getTime() };
  } else {
    const to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
    const from = new Date(to);
    from.setMonth(to.getMonth() - 4);
    return { fromVal: from.getTime(), toVal: to.getTime() };
  }
};

const formatRangeTitle = (win: string, fVal: number, tVal: number): string => {
  const fDate = new Date(fVal);
  const tDate = new Date(tVal);

  const fMonth = fDate.toLocaleString('en-US', { month: 'short' });
  const fYear = fDate.getFullYear().toString().slice(-2);
  const tMonth = tDate.toLocaleString('en-US', { month: 'short' });
  const tYear = tDate.getFullYear().toString().slice(-2);

  if (win === 'weekly') {
    const fWeek = getISOWeek(fDate).week;
    const tWeek = getISOWeek(tDate).week;

    if (fVal === tVal) {
      return `AI Consumption Week ${fWeek} ${fMonth} ${fYear}`;
    } else {
      return `AI Consumption Week ${fWeek} ${fMonth} ${fYear} - Week ${tWeek} ${tMonth} ${tYear}`;
    }
  } else {
    if (fVal === tVal) {
      return `AI Consumption ${fMonth} ${fYear}`;
    } else {
      return `AI Consumption ${fMonth} ${fYear} - ${tMonth} ${tYear}`;
    }
  }
};

export const AIConsumption: React.FC = () => {
  const { t } = useKialiTranslation();
  const lineRef = React.useRef<HTMLDivElement>(null);
  const lineWidth = useContainerWidth(lineRef) || 800;

  const [summary, setSummary] = React.useState<AIUsageResponse['summary'] | null>(null);
  const [timeSeries, setTimeSeries] = React.useState<AIUsageResponse['timeSeries'] | null>(null);
  const [providersOptions, setProvidersOptions] = React.useState<string[]>([]);
  const [providerVisible, setProviderVisible] = React.useState<string>('All');
  const [topSummary, setTopSummary] = React.useState<AIUsageResponse['topSummary'] | null>(null);

  const [window, setWindow] = React.useState<string>('weekly');
  const [fromVal, setFromVal] = React.useState<number>(() => getDefaultRange('weekly').fromVal);
  const [toVal, setToVal] = React.useState<number>(() => getDefaultRange('weekly').toVal);
  const [limit, setLimit] = React.useState<number>(5);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>('');
  const [valueKind, setValueKind] = React.useState<UsageValueKind>('cost');

  const getApiRange = React.useCallback((win: string, fVal: number, tVal: number): { from: number; since: number } => {
    if (win === 'weekly') {
      return {
        from: fVal,
        since: tVal + 7 * 24 * 60 * 60 * 1000
      };
    } else {
      const d = new Date(tVal);
      d.setMonth(d.getMonth() + 1);
      return {
        from: fVal,
        since: d.getTime()
      };
    }
  }, []);

  const loadUsage = React.useCallback(
    async (win: string, fVal: number, tVal: number, lim: number): Promise<void> => {
      if (fVal === 0 || tVal === 0) return;
      setLoading(true);
      try {
        const apiRange = getApiRange(win, fVal, tVal);
        const response = await API.getAIUsage(
          undefined,
          undefined,
          undefined,
          undefined,
          win as 'weekly' | 'monthly',
          Math.floor(apiRange.from / 1000),
          Math.floor(apiRange.since / 1000),
          true, // consumption
          lim
        );
        const aiUsage: AIUsageResponse = response.data;
        setSummary(aiUsage.summary);
        setTimeSeries(aiUsage.timeSeries);
        setProvidersOptions([
          'All',
          ...(aiUsage.summary!.byProvider.map(p => p.provider!).filter(p => p !== undefined) as string[])
        ]);
        setTopSummary(aiUsage.topSummary);
        setError('');
      } catch (err) {
        setError(API.getErrorString(err as any));
      } finally {
        setLoading(false);
      }
    },
    [getApiRange]
  );

  React.useEffect(() => {
    void loadUsage(window, fromVal, toVal, limit);
  }, [loadUsage, window, fromVal, toVal, limit]);

  React.useEffect(() => {
    return onAIResponseReceived(() => void loadUsage(window, fromVal, toVal, limit));
  }, [loadUsage, window, fromVal, toVal, limit]);

  const handleWindowChange = (newWindow: string): void => {
    setWindow(newWindow);
    const { fromVal: defaultFrom, toVal: defaultTo } = getDefaultRange(newWindow);
    setFromVal(defaultFrom);
    setToVal(defaultTo);
  };

  const {
    colorScale: lineColorScale,
    legend: lineLegend,
    seriesData,
    xTickValues
  } = React.useMemo(
    () => getLineChartData(timeSeries, providerVisible, providersOptions, 'totalTokens', valueKind),
    [timeSeries, providerVisible, providersOptions, valueKind]
  );

  const chartWidth = Math.max(0, Math.floor(lineWidth * 0.98));
  const legendRightPadding = React.useMemo(() => {
    const longest = lineLegend.reduce((max, item) => Math.max(max, item.name.length), 0);
    const desired = Math.max(180, longest * 10 + 56);
    const maxRight = Math.max(160, Math.floor(chartWidth * 0.4));
    return Math.min(desired, maxRight);
  }, [chartWidth, lineLegend]);

  // We need to find the currency to use for formatting
  const currency = React.useMemo(() => {
    if (!summary || summary.byProvider.length === 0) return 'USD';
    const totalRow = summary.byProvider.find(p => p.provider === 'total');
    return totalRow?.cost?.currency || 'USD';
  }, [summary]);

  const emptyState = (
    <EmptyState headingLevel="h4" titleText={t('No consumption stats yet')}>
      <EmptyStateBody>{t('This view will populate after you use Chat AI.')}</EmptyStateBody>
    </EmptyState>
  );

  const errorState = (
    <EmptyState headingLevel="h4" titleText={t('Unable to load consumption stats')}>
      <EmptyStateBody>{error}</EmptyStateBody>
    </EmptyState>
  );

  return (
    <div>
      <AIConsumptionHeader
        fromVal={fromVal}
        onRangeChange={(newFrom, newTo) => {
          setFromVal(newFrom);
          setToVal(newTo);
        }}
        onValueKindChange={setValueKind}
        onWindowChange={handleWindowChange}
        title={formatRangeTitle(window, fromVal, toVal)}
        toVal={toVal}
        valueKind={valueKind}
        window={window}
      />
      <Grid hasGutter>
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
              <AIKPI
                metric="totalTokens"
                onProviderChange={setProviderVisible}
                showTokens
                summary={summary ?? { byModel: [], byProvider: [] }}
                valueKind={valueKind}
              />
            </GridItem>
            <GridItem span={12}>
              <div className={chartBoxStyle} ref={lineRef}>
                {seriesData.length > 0 && chartWidth > 0 && (
                  <Chart
                    ariaDesc={valueKind === 'cost' ? 'AI cost over time' : 'AI tokens over time'}
                    ariaTitle={valueKind === 'cost' ? 'Cost time series' : 'Token time series'}
                    colorScale={lineColorScale}
                    containerComponent={
                      <ChartVoronoiContainer
                        constrainToVisibleArea
                        labels={({ datum }) =>
                          datum.y != null
                            ? `${datum.name}: ${
                                valueKind === 'cost' ? formatCost(datum.y, currency) : formatTokensInMillions(datum.y)
                              }`
                            : ''
                        }
                      />
                    }
                    height={320}
                    legendData={lineLegend}
                    legendOrientation="vertical"
                    legendPosition="right"
                    padding={{ bottom: 50, left: 70, right: legendRightPadding, top: 20 }}
                    width={chartWidth}
                  >
                    <ChartAxis
                      tickValues={xTickValues}
                      tickFormat={(t, i) => (i % Math.max(1, Math.floor(xTickValues.length / 12)) === 0 ? t : '')}
                      style={{ tickLabels: { angle: -30, fontSize: 8 } }}
                    />
                    <ChartAxis
                      dependentAxis
                      showGrid
                      tickFormat={t =>
                        valueKind === 'cost' ? formatCost(t as number, currency) : formatTokensInMillions(t as number)
                      }
                    />
                    <ChartStack>
                      {seriesData.map((points, i) => (
                        <ChartBar key={i} data={points} />
                      ))}
                    </ChartStack>
                  </Chart>
                )}
              </div>
            </GridItem>
            <GridItem span={12}>
              <AIConsumptionTables limit={limit} onLimitChange={setLimit} summary={topSummary} valueKind={valueKind} />
            </GridItem>
          </>
        )}
      </Grid>
    </div>
  );
};
