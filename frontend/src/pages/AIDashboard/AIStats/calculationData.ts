import { formatCost, formatTokensInMillions } from 'types/Chatbot';
import type { AITokenRow, AIUsageResponse, TokenMetric, UsageValueKind } from 'types/Chatbot';
import { buildColorScale } from './colorPalette';

// ── Provider filter helpers ───────────────────────────────────────────────────

/** Parses the provider string into a Set, or null for 'All'. */
const toProviderSet = (provider: string): Set<string> | null =>
  provider === 'All'
    ? null
    : new Set(
        provider
          .split(',')
          .map(p => p.trim())
          .filter(Boolean)
      );

/** True when an item matches the provider filter (null = All = always matches). */
const matchesProvider = (set: Set<string> | null, p: string | undefined): boolean => set === null || set.has(p ?? '');

/**
 * Display label for a row:
 *  - All             → provider name
 *  - single provider → model name
 *  - multiple        → "provider/model" so each line stays identifiable
 */
const rowLabel = (item: AITokenRow, set: Set<string> | null): string => {
  if (set === null) return item.provider ?? 'Unknown';
  if (set.size === 1) return item.model ?? 'Unknown';
  return `${item.provider ?? '?'}/${item.model ?? '?'}`;
};

// ── Donut chart ───────────────────────────────────────────────────────────────

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
  providersOptions: string[],
  key: keyof Pick<AITokenRow, 'promptTokens' | 'completionTokens' | 'totalTokens'>,
  cost = false
): { colorScale: string[]; data: DonutDataPoint[]; legend: DonutLegendItem[]; total: number } => {
  if (!dataSummary) return { colorScale: [], data: [], legend: [], total: 0 };

  const set = toProviderSet(provider);
  const specificProviders = providersOptions.filter(p => p !== 'All');

  // 'All' → one slice per provider; otherwise → one slice per model for selected providers.
  const rows: AITokenRow[] =
    set === null
      ? dataSummary.byProvider.filter(item => item.provider !== 'total')
      : dataSummary.byModel.filter(item => matchesProvider(set, item.provider));

  const itemValue = (item: AITokenRow): number => (cost ? (item.cost?.total ?? item[key]) : item[key]);
  const total = rows.reduce((acc, item) => acc + itemValue(item), 0);
  const donutData = rows.map(item => ({ x: rowLabel(item, set), y: itemValue(item) }));
  const legendData = rows.map(item => ({
    name: `${rowLabel(item, set)}: ${cost ? formatCost(itemValue(item), item.cost?.currency ?? 'USD') : formatTokensInMillions(itemValue(item))}`
  }));
  // byModel=false when 'All' (one colour per provider); true when filtered (shades per model).
  const colorScale = buildColorScale(specificProviders, rows, set !== null);

  return { colorScale, data: donutData, legend: legendData, total };
};

// ── Stacked bar (consumption by token type) ───────────────────────────────────

export interface ConsumptionByTokenTypeData {
  name: string;
  x: string;
  y: number;
}

const legendConsumption: DonutLegendItem[] = [{ name: 'promptTokens' }, { name: 'completionTokens' }];

export const getConsumptionByTokenTypeData = (
  dataSummary: AIUsageResponse['summary']['byModel'] | null,
  provider: string,
  metric: TokenMetric
): { data: ConsumptionByTokenTypeData[][]; legend: DonutLegendItem[] } => {
  const set = toProviderSet(provider);
  const rows = (dataSummary ?? []).filter(item => matchesProvider(set, item.provider));
  const legend = metric === 'totalTokens' ? legendConsumption : [{ name: metric }];

  const data: ConsumptionByTokenTypeData[][] = legend.map(legendItem =>
    rows.map(item => ({
      name: legendItem.name,
      x: rowLabel(item, set),
      y: item[legendItem.name as keyof AITokenRow] as number
    }))
  );

  return { data, legend };
};

// ── Line chart ────────────────────────────────────────────────────────────────

export interface LineDataPoint {
  name: string;
  x: string;
  y: number;
}

export const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

/** Format an ISO timestamp to a human-readable label, e.g. "Jun 19, 08:00". */
const formatTimestamp = (iso: string, window: string): string => {
  const d = new Date(iso);
  if (window === 'monthly') {
    return `${d.toLocaleString([], { month: 'short' })}(${d.getFullYear().toString().slice(2)})`;
  }
  if (window === 'weekly') {
    return `week-${getWeekNumber(d)} (${d.toLocaleString([], { month: 'short' })})`;
  }
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

/**
 * Transforms `timeSeries` into data ready for a PatternFly line chart.
 *
 * - provider === 'All'         → all series,  label = "provider/model"
 * - provider === "a"           → filter to a, label = model
 * - provider === "a,b"         → filter to a and b, label = "provider/model"
 */
export interface LineChartData {
  colorScale: string[];
  legend: { name: string }[];
  seriesData: LineDataPoint[][];
  xTickValues: string[];
}

export const getLineChartData = (
  timeSeries: AIUsageResponse['timeSeries'] | null,
  provider: string,
  providersOptions: string[],
  key: TokenMetric,
  valueKind: UsageValueKind = 'tokens'
): LineChartData => {
  const empty: LineChartData = { colorScale: [], legend: [], seriesData: [], xTickValues: [] };
  if (!timeSeries?.series?.length) return empty;

  const set = toProviderSet(provider);
  const specificProviders = providersOptions.filter(p => p !== 'All');
  const filtered = timeSeries.series.filter(s => matchesProvider(set, s.provider));

  if (!filtered.length) return empty;

  // Use provider/model when 'All' or multiple providers are selected.
  const seriesLabel = (s: { model: string; provider: string }): string =>
    set === null || set.size > 1 ? `${s.provider}/${s.model}` : s.model;

  const legend = filtered.map(s => ({ name: seriesLabel(s) }));

  const seriesData: LineDataPoint[][] = filtered.map(s =>
    s.points.map(p => ({
      name: seriesLabel(s),
      x: formatTimestamp(p.timestamp, timeSeries.window),
      y: valueKind === 'cost' ? (p.cost?.total ?? 0) : p[key]
    }))
  );

  const xTickValues = filtered[0].points.map(p => formatTimestamp(p.timestamp, timeSeries.window));

  // byModel=false when 'All' (one main colour per provider);
  // true when specific providers selected (shades per model within each provider).
  const colorScale = buildColorScale(specificProviders, filtered, set !== null);

  return { colorScale, legend, seriesData, xTickValues };
};

export interface StackThresholdChartData extends LineChartData {
  maxY: number;
  thresholdData: LineDataPoint[];
}

/** Stacked weekly (or monthly) amounts plus an optional budget threshold line. */
export const getStackThresholdChartData = (
  timeSeries: AIUsageResponse['timeSeries'] | null,
  provider: string,
  providersOptions: string[],
  key: TokenMetric,
  thresholdY: number,
  valueKind: UsageValueKind = 'tokens'
): StackThresholdChartData => {
  const line = getLineChartData(timeSeries, provider, providersOptions, key, valueKind);
  const totalsByX = new Map<string, number>();
  for (const series of line.seriesData) {
    for (const point of series) {
      totalsByX.set(point.x, (totalsByX.get(point.x) ?? 0) + point.y);
    }
  }
  const maxY = Math.max(thresholdY, ...totalsByX.values(), 0);
  const thresholdData =
    thresholdY > 0 && line.xTickValues.length > 0
      ? [
          { name: 'Budget threshold', x: line.xTickValues[0], y: thresholdY },
          { name: 'Budget threshold', x: line.xTickValues[line.xTickValues.length - 1], y: thresholdY }
        ]
      : [];

  return { ...line, maxY, thresholdData };
};
