import * as React from 'react';
import { Bullseye, Divider, EmptyState, EmptyStateBody, Grid, GridItem, Spinner, Title } from "@patternfly/react-core";
import * as API from 'services/Api';
import { AIUsageResponse, TokenMetric } from 'types/Chatbot';
import {
    Chart,
    ChartAxis,
    ChartDonut,
    ChartGroup,
    ChartLine,
    ChartThemeColor,
    ChartVoronoiContainer
} from '@patternfly/react-charts/victory';
import { getDonutDataBy, getLineChartData } from './calculationData';
import { AIStatsToolbar } from './AIStatsToolbar';
import { DurationInSeconds } from 'types/Common';
import { onAIResponseReceived } from 'utils/aiEvents';
import { useKialiTranslation } from 'utils/I18nUtils';

const CHART_HEIGHT = 300;

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
    const lineRef  = React.useRef<HTMLDivElement>(null);
    const donutWidth = useContainerWidth(donutRef) || 400;
    const lineWidth  = useContainerWidth(lineRef)  || 600;

    const [summary, setSummary] = React.useState<AIUsageResponse['summary'] | null>(null);
    const [timeSeries, setTimeSeries] = React.useState<AIUsageResponse['timeSeries'] | null>(null);
    const [providersOptions, setProvidersOptions] = React.useState<string[]>([]);
    const [provider, setProvider] = React.useState<string>('All');
    const [tokenMetric, setTokenMetric] = React.useState<TokenMetric>('totalTokens');
    const [duration, setDuration] = React.useState<DurationInSeconds>(86400);
    const [step, setStep] = React.useState<DurationInSeconds>(3600);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string>('');

    const loadUsage = React.useCallback(async (windowSecs: DurationInSeconds, stepSecs: DurationInSeconds): Promise<void> => {
        setLoading(true);        
        try {
            const response = await API.getAIUsage(windowSecs, stepSecs);
            const aiUsage: AIUsageResponse = response.data;
            setSummary(aiUsage.summary);
            setTimeSeries(aiUsage.timeSeries);
            setProvidersOptions(['All', ...aiUsage.summary!.byProvider.map(p => p.provider!).filter(p => p !== undefined) as string[]]);
            setError('');
          } catch (err) {
            setError(API.getErrorString(err as any));
          } finally {
            setLoading(false);
          }
       }, []);

    React.useEffect(() => {
        void loadUsage(duration, step);
    }, [loadUsage, duration, step]);

    // Refresh whenever the chatbot delivers a new response.
    React.useEffect(() => {
        return onAIResponseReceived(() => void loadUsage(duration, step));
    }, [loadUsage, duration, step]);

    const handleFilterChange = (newProvider: string, newMetric: TokenMetric, newDuration: DurationInSeconds, newStep: DurationInSeconds) => {
        setProvider(newProvider);
        setTokenMetric(newMetric);
        setDuration(newDuration);
        setStep(newStep);
    };

    const { data, legend, total } = React.useMemo(
        () => getDonutDataBy(summary, provider, tokenMetric),
        [summary, tokenMetric, provider]
    );

    const { legend: lineLegend, seriesData, xTickValues } = React.useMemo(
        () => getLineChartData(timeSeries, provider, tokenMetric),
        [timeSeries, provider, tokenMetric]
    );

    const emptyState = (
        <EmptyState headingLevel="h4" titleText={t('No token stats yet')}>
          <EmptyStateBody>
            {t('This view will populate after you use Chat AI.')}
          </EmptyStateBody>
        </EmptyState>
      );
    
      const errorState = (
        <EmptyState headingLevel="h4" titleText={t('Unable to load token stats')}>
          <EmptyStateBody>{error}</EmptyStateBody>
        </EmptyState>
      );
    return (    
        <div>
            <Title headingLevel="h1">AI Stats - {tokenMetric} - {provider === 'All' ? 'All Providers' : provider}</Title>
            <Divider component="div" />
            <Grid hasGutter style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>  
                {loading ? (
                    <Bullseye data-test="session-token-stats-loading">
                        <Spinner size="xl" />
                    </Bullseye>
                ) : error ? (
                    errorState
                ) : summary && summary.byProvider.length === 0 ? emptyState : (
                    <>
                        <GridItem span={12}>              
                            <AIStatsToolbar
                    duration={duration}
                    step={step}
                    provider={provider}
                    tokenMetric={tokenMetric}
                    providersOptions={providersOptions}
                    onFilterChange={handleFilterChange}
                />
                        </GridItem>
                        <GridItem span={4}>
                            <div
                                ref={donutRef}
                                style={{ alignItems: 'center', display: 'flex', height: `${CHART_HEIGHT}px`, justifyContent: 'center', width: '100%' }}
                            >
                               {data.length > 0 && <ChartDonut
                                        ariaTitle="Tokens Consumption by Provider"
                                        data={data}
                                        constrainToVisibleArea
                                        legendData={legend}
                                        legendPosition="bottom"
                                        height={CHART_HEIGHT}
                                        width={donutWidth}
                                        padding={{ bottom: 80, left: 20, right: 20, top: 20 }}
                                        subTitle="Tokens"
                                        title={total.toLocaleString()}
                                        themeColor={ChartThemeColor.multiOrdered}
                                        labels={({ datum }) => `${datum.x}: ${datum.y} tokens`}
                                    />}
                            </div>
                        </GridItem>
                        <GridItem span={8}>
                            <div
                                ref={lineRef}
                                style={{ height: `${CHART_HEIGHT}px`, minWidth: 0, overflow: 'hidden', width: '100%' }}
                            >
                                    {seriesData.length > 0 && <Chart
                                        ariaDesc="AI token usage over time"
                                        ariaTitle="Token usage time series"
                                        containerComponent={
                                            <ChartVoronoiContainer
                                                labels={({ datum }) => `${datum.name}\n${datum.x}\n${datum.y.toLocaleString()} tokens`}
                                                constrainToVisibleArea
                                            />
                                        }
                                        legendData={lineLegend}
                                        legendOrientation="vertical"
                                        legendPosition="right"
                                        height={CHART_HEIGHT}
                                        width={lineWidth}
                                        padding={{ bottom: 70, left: 60, right: 200, top: 20 }}
                                        themeColor={ChartThemeColor.multiOrdered}
                                    >
                                        <ChartAxis
                                            tickValues={xTickValues}
                                            tickFormat={(t, i) => i % Math.max(1, Math.floor(xTickValues.length / 12)) === 0 ? t : ''}
                                            style={{ tickLabels: { angle: -30, fontSize: 8 } }}
                                        />
                                        <ChartAxis dependentAxis showGrid />
                                        <ChartGroup>
                                            {seriesData.map((points, i) => (
                                                <ChartLine key={i} data={points} />
                                            ))}
                                        </ChartGroup>
                                    </Chart>}
                            </div>
                        </GridItem>
                
                    </>)}               
            </Grid>            
        </div>
    );
};