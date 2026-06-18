import { AITokenRow, AIUsageResponse, TokenMetric } from "types/Chatbot";

export interface DonutDataPoint {
    x: string;
    y: number;
}

export interface DonutLegendItem {
    name: string;
}

export const getDonutDataBy = (
    dataSummary: AIUsageResponse['summary'] | null,
    provider: string,
    key: keyof Pick<AITokenRow, 'promptTokens' | 'completionTokens' | 'totalTokens'>
): { data: DonutDataPoint[]; legend: DonutLegendItem[]; total: number } => {
    if (!dataSummary) return { data: [], legend: [], total: 0 };
    const data = provider === 'All' ? dataSummary.byProvider : dataSummary.byModel.filter(item => item.provider === provider);
    const label = (item: AITokenRow): string => 
        provider === 'All' ? (item.provider ?? 'Unknown') : (item.model ?? 'Unknown');
    const total = data.reduce((acc, item) => acc + item[key], 0);
    const donutData = data.map(item => ({
        x: label(item),
        y: item[key]
    }));

    const legendData = data.map(item => ({
        name: `${label(item)}: ${item[key].toLocaleString()}`
    }));

    return { data: donutData, legend: legendData, total };
};

// ── Line chart ────────────────────────────────────────────────────────────────

export interface LineDataPoint {
    name: string;
    x: string;
    y: number;
}

export interface LineChartData {
    /** One entry per ChartLine – passed to Chart legendData */
    legend: { name: string }[];
    /** One array per ChartLine – each element is the data prop of a <ChartLine /> */
    seriesData: LineDataPoint[][];
    /** Sparse tick labels for the X axis (every Nth timestamp) */
    xTickValues: string[];
}

/** Format an ISO timestamp to a short "MM/DD HH:mm" label */
const formatTimestamp = (iso: string): string => {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
};

/**
 * Transforms `timeSeries` into data ready for a PatternFly line chart.
 *
 * - provider === 'All'  → all series, label = "provider/model"
 * - provider === <name> → filter by provider, label = model name
 */
export const getLineChartData = (
    timeSeries: AIUsageResponse['timeSeries'] | null,
    provider: string,
    key: TokenMetric
): LineChartData => {
    const empty: LineChartData = { legend: [], seriesData: [], xTickValues: [] };
    if (!timeSeries?.series?.length) return empty;

    const filtered = provider === 'All'
        ? timeSeries.series
        : timeSeries.series.filter(s => s.provider === provider);

    if (!filtered.length) return empty;

    const legend = filtered.map(s => ({
        name: provider === 'All' ? `${s.provider}/${s.model}` : s.model
    }));

    const seriesData: LineDataPoint[][] = filtered.map(s =>
        s.points.map(p => ({
            name: provider === 'All' ? `${s.provider}/${s.model}` : s.model,
            x: formatTimestamp(p.timestamp),
            y: p[key]
        }))
    );

    // X-axis ticks: show one label every ~5 points to avoid crowding
    const numPoints = filtered[0].points.length;
    const tickEvery = Math.max(1, Math.floor(numPoints / 5));
    const xTickValues = filtered[0].points
        .filter((_, i) => i % tickEvery === 0)
        .map(p => formatTimestamp(p.timestamp));

    return { legend, seriesData, xTickValues };
};
