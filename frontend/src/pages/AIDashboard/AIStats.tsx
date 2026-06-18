import * as React from 'react';
import { Divider, Grid, GridItem, Title } from "@patternfly/react-core";
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


export const AIStats: React.FC = () => {

    const [summary, setSummary] = React.useState<AIUsageResponse['summary'] | null>(null);
    const [timeSeries, setTimeSeries] = React.useState<AIUsageResponse['timeSeries'] | null>(null);
    const [providersOptions, setProvidersOptions] = React.useState<string[]>([]);
    const [provider, setProvider] = React.useState<string>('All');
    const [tokenMetric, setTokenMetric] = React.useState<TokenMetric>('totalTokens');
    const [duration, setDuration] = React.useState<DurationInSeconds>(86400);
    const [step, setStep] = React.useState<DurationInSeconds>(3600);

    const loadUsage = React.useCallback(async (windowSecs: DurationInSeconds, stepSecs: DurationInSeconds): Promise<void> => {
        const response = await API.getAIUsage(windowSecs, stepSecs);
        const aiUsage: AIUsageResponse = response.data;
        setSummary(aiUsage.summary);
        setTimeSeries(aiUsage.timeSeries);
        setProvidersOptions(['All', ...aiUsage.summary!.byProvider.map(p => p.provider!).filter(p => p !== undefined) as string[]]);
    }, []);

    React.useEffect(() => {
        void loadUsage(duration, step);
    }, [loadUsage, duration, step]);

    const handleFilterChange = (newProvider: string, metric: TokenMetric, newDuration: DurationInSeconds, newStep: DurationInSeconds) => {
        setTokenMetric(metric);
        setProvider(newProvider);
        if (newDuration !== duration) setDuration(newDuration);
        if (newStep !== step) setStep(newStep);
    };

    const { data, legend, total } = React.useMemo(
        () => getDonutDataBy(summary, provider, tokenMetric),
        [summary, tokenMetric, provider, providersOptions]
    );

    const { legend: lineLegend, seriesData, xTickValues } = React.useMemo(
        () => getLineChartData(timeSeries, provider, tokenMetric),
        [timeSeries, provider, tokenMetric]
    );

    return (    
        <div>
            <Title headingLevel="h1">AI Stats</Title>
            <Divider component="div" />
            <Grid hasGutter style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>  
            <GridItem span={12}>              
                <AIStatsToolbar providersOptions={providersOptions} onFilterChange={handleFilterChange}/>
            </GridItem>
                <GridItem span={4}>
                    {summary && (
                        <div style={{ height: '275px', width: '300px' }}>
                    <ChartDonut
                        ariaTitle="Tokens Consumption by Provider"
                        data={data}
                        constrainToVisibleArea
                        legendData={legend}
                        legendPosition="bottom"
                        padding={{
                            bottom: 65, // Adjusted to accommodate legend
                            left: 20,
                            right: 20,
                            top: 20
                          }}
                        subTitle="Tokens"
                        title={total.toLocaleString()}
                        themeColor={ChartThemeColor.multiOrdered}
                        labels={({ datum }) => `${datum.x}: ${datum.y} tokens`}
                    /></div>)}
                </GridItem>
                <GridItem span={8}>
                    {timeSeries && seriesData.length > 0 && (
                        <div style={{ height: '275px', width: '100%' }}>
                            <Chart
                                ariaDesc="AI token usage over time"
                                ariaTitle="Token usage time series"
                                containerComponent={
                                    <ChartVoronoiContainer
                                        labels={({ datum }) => `${datum.name}: ${datum.y.toLocaleString()} tokens`}
                                        constrainToVisibleArea
                                    />
                                }
                                legendData={lineLegend}
                                legendOrientation="vertical"
                                legendPosition="right"
                                height={250}
                                padding={{ bottom: 60, left: 60, right: 200, top: 20 }}
                                themeColor={ChartThemeColor.multiOrdered}
                                width={1000}
                            >
                                <ChartAxis tickValues={xTickValues} style={{ tickLabels: { angle: -30, fontSize: 8 } }} />
                                <ChartAxis dependentAxis showGrid />
                                <ChartGroup>
                                    {seriesData.map((points, i) => (
                                        <ChartLine key={i} data={points} />
                                    ))}
                                </ChartGroup>
                            </Chart>
                        </div>
                    )}
                </GridItem>
            </Grid>
        </div>
    );
};