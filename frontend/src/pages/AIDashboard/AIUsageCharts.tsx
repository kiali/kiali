import * as React from 'react';
import {
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  Flex,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip
} from '@patternfly/react-core';
import {
  Chart,
  ChartAxis,
  ChartBullet,
  ChartGroup,
  ChartLine,
  ChartThreshold,
  ChartVoronoiContainer
} from '@patternfly/react-charts/victory';
import { PFColors } from 'components/Pf/PfColors';
import { KialiIcon } from 'config/KialiIcon';
import { helpIconStyle } from 'styles/IconStyle';
import { PFSpacer } from 'styles/PfSpacer';
import { kialiStyle } from 'styles/StyleUtils';
import { AITimeSeriesEntry, ChatSessionUsageBudget, formatCost, formatTokensInMillions } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import { TOKEN_METRIC_COLORS } from './AIStats/colorPalette';

const bulletHeight = 96;

const bulletWrapStyle = kialiStyle({
  height: `${bulletHeight}px`,
  marginTop: PFSpacer.xs,
  overflow: 'visible',
  width: '100%'
});

const thresholdWrapStyle = kialiStyle({
  height: '280px',
  minWidth: 0,
  overflow: 'hidden',
  width: '100%'
});

const usedCaptionStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)'
});

const budgetValueStyle = kialiStyle({
  fontSize: 'var(--pf-t--global--font--size--xl)',
  fontWeight: 700
});

const tooltipBodyStyle = kialiStyle({
  textAlign: 'left'
});

const metricToggleStyle = kialiStyle({
  marginBottom: PFSpacer.sm
});

const useContainerWidth = (ref: React.RefObject<HTMLDivElement | null>): number => {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) {
      return;
    }
    const initial = ref.current.offsetWidth || Math.floor(ref.current.getBoundingClientRect().width);
    if (initial > 0) {
      setWidth(initial);
    }
    const observer = new ResizeObserver(entries => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) {
        setWidth(w);
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

export const budgetUsedPercent = (max: number, remaining: number): number => {
  if (max <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, ((max - remaining) / max) * 100));
};

type BudgetBulletCardProps = {
  'data-test': string;
  formatValue: (value: number) => string;
  icon: React.ReactNode;
  label: string;
  max: number;
  remaining: number;
};

export const BudgetBulletCard: React.FC<BudgetBulletCardProps> = ({
  'data-test': dataTest,
  formatValue,
  icon,
  label,
  max,
  remaining
}) => {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const width = useContainerWidth(wrapRef) || 280;
  const usedPct = budgetUsedPercent(max, remaining);
  const usedLabel = t('Used');
  const used = Math.max(0, max - remaining);
  const remainingTooltip = (
    <div className={tooltipBodyStyle}>
      <div>{t('The first number is remaining budget, not usage.')}</div>
      <div>
        {t('Remaining: {{remaining}} of {{max}}', {
          max: formatValue(max),
          remaining: formatValue(remaining)
        })}
      </div>
      <div>{t('Used this period: {{used}}', { used: formatValue(used) })}</div>
    </div>
  );

  return (
    <Card isCompact data-test={dataTest}>
      <CardTitle>
        {icon} {label}
        <Tooltip content={remainingTooltip}>
          <span aria-label={t('Remaining budget explanation')} className={helpIconStyle} data-test={`${dataTest}-help`}>
            <KialiIcon.Help />
          </span>
        </Tooltip>
      </CardTitle>
      <CardBody>
        <Flex
          alignItems={{ default: 'alignItemsBaseline' }}
          gap={{ default: 'gapMd' }}
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
        >
          <Tooltip content={remainingTooltip}>
            <span className={budgetValueStyle} data-test={`${dataTest}-value`} tabIndex={0}>
              {`${formatValue(remaining)} / ${formatValue(max)}`}
            </span>
          </Tooltip>
          {max > 0 && (
            <div className={usedCaptionStyle} data-test={`${dataTest}-percent`}>
              {`${usedPct.toFixed(0)}% ${t('of budget used')}`}
            </div>
          )}
        </Flex>
        <div className={usedCaptionStyle} data-test={`${dataTest}-ratio-label`}>
          {t('remaining / budget')}
        </div>
        {max > 0 && (
          <div className={bulletWrapStyle} ref={wrapRef}>
            {width > 0 && (
              <ChartBullet
                allowTooltip
                ariaTitle={t('Budget used')}
                axisComponent={<ChartAxis offsetY={28} />}
                bulletSize={bulletHeight}
                comparativeErrorMeasureData={[{ name: t('Critical'), y: 100 }]}
                comparativeWarningMeasureData={[{ name: t('Warning'), y: 80 }]}
                constrainToVisibleArea
                height={bulletHeight}
                labels={({ datum }) => `${datum.name}: ${Number(datum.y).toFixed(0)}%`}
                maxDomain={{ y: 100 }}
                name={dataTest}
                padding={{ bottom: 36, left: 16, right: 16, top: 0 }}
                primarySegmentedMeasureData={[{ name: usedLabel, y: usedPct }]}
                qualitativeRangeData={[
                  { name: t('OK'), y: 50 },
                  { name: t('Warning'), y: 75 },
                  { name: t('Critical'), y: 100 }
                ]}
                width={width}
              />
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

type PeriodPoint = {
  cost: number;
  timestamp: string;
  totalTokens: number;
};

const startOfISOWeek = (value: Date): Date => {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const padWeekDomain = (points: PeriodPoint[]): PeriodPoint[] => {
  if (points.length === 0) {
    return points;
  }
  const weekStart = startOfISOWeek(new Date()).toISOString();
  const now = new Date().toISOString();
  const padded = [...points];
  if (new Date(padded[0].timestamp).getTime() > new Date(weekStart).getTime()) {
    padded.unshift({ cost: 0, timestamp: weekStart, totalTokens: 0 });
  }
  const last = padded[padded.length - 1];
  if (new Date(last.timestamp).getTime() < Date.now() - 60_000) {
    padded.push({ cost: last.cost, timestamp: now, totalTokens: last.totalTokens });
  }
  return padded;
};

const snapToBudgetUsed = (points: PeriodPoint[], budget: ChatSessionUsageBudget | null): PeriodPoint[] => {
  if (!budget?.has_budget || points.length === 0) {
    return points;
  }
  const usedTokens = Math.max(0, budget.max_tokens - budget.remaining_tokens);
  const usedCost = Math.max(0, budget.max_cost - budget.remaining_cost);
  const last = points[points.length - 1];
  if (usedTokens > 0 && last.totalTokens > usedTokens * 1.02) {
    const tokenScale = usedTokens / last.totalTokens;
    const costScale = last.cost > 0 && usedCost >= 0 ? usedCost / last.cost : 1;
    return points.map(point => ({
      ...point,
      cost: point.cost * costScale,
      totalTokens: point.totalTokens * tokenScale
    }));
  }
  if (usedTokens <= last.totalTokens && usedCost <= last.cost) {
    return points;
  }
  const next = [...points];
  const snapped = {
    cost: Math.max(last.cost, usedCost),
    timestamp: last.timestamp,
    totalTokens: Math.max(last.totalTokens, usedTokens)
  };
  if (new Date(last.timestamp).getTime() >= Date.now() - 60_000) {
    next[next.length - 1] = snapped;
    return next;
  }
  next.push({ ...snapped, timestamp: new Date().toISOString() });
  return next;
};

const aggregateCumulative = (series: AITimeSeriesEntry[] | undefined): PeriodPoint[] => {
  const byTs = new Map<string, { cost: number; totalTokens: number }>();
  for (const entry of series ?? []) {
    for (const point of entry.points) {
      const cur = byTs.get(point.timestamp) ?? { cost: 0, totalTokens: 0 };
      cur.totalTokens += point.totalTokens;
      cur.cost += point.cost?.total ?? 0;
      byTs.set(point.timestamp, cur);
    }
  }

  const sorted = [...byTs.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  let tokens = 0;
  let cost = 0;
  return sorted.map(([timestamp, value]) => {
    tokens += value.totalTokens;
    cost += value.cost;
    return { cost, timestamp, totalTokens: tokens };
  });
};

const formatTick = (value: Date): string =>
  value.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

type CurrentWeekThresholdChartProps = {
  budget: ChatSessionUsageBudget | null;
  series: AITimeSeriesEntry[] | undefined;
};

export const CurrentWeekThresholdChart: React.FC<CurrentWeekThresholdChartProps> = ({ budget, series }) => {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const width = useContainerWidth(wrapRef) || 400;
  const points = React.useMemo(
    () => snapToBudgetUsed(padWeekDomain(aggregateCumulative(series)), budget),
    [budget, series]
  );
  const hasTokenBudget = (budget?.max_tokens ?? 0) > 0;
  const hasCostBudget = (budget?.max_cost ?? 0) > 0;
  const [metric, setMetric] = React.useState<'tokens' | 'cost'>(hasTokenBudget ? 'tokens' : 'cost');

  React.useEffect(() => {
    if (metric === 'tokens' && !hasTokenBudget && hasCostBudget) {
      setMetric('cost');
    }
    if (metric === 'cost' && !hasCostBudget && hasTokenBudget) {
      setMetric('tokens');
    }
  }, [hasCostBudget, hasTokenBudget, metric]);

  const lineData = points.map(point => ({
    name: metric === 'tokens' ? t('Tokens') : t('Cost'),
    x: new Date(point.timestamp),
    y: metric === 'tokens' ? point.totalTokens : point.cost
  }));
  const thresholdY = metric === 'tokens' ? (budget?.max_tokens ?? 0) : (budget?.max_cost ?? 0);
  const firstX = lineData[0]?.x;
  const lastX = lineData[lineData.length - 1]?.x;
  const thresholdData =
    firstX && lastX && thresholdY > 0
      ? [
          { name: t('Budget threshold'), x: firstX, y: thresholdY },
          { name: t('Budget threshold'), x: lastX, y: thresholdY }
        ]
      : [];
  const maxY = Math.max(thresholdY, ...lineData.map(d => d.y), 0);
  const formatY = (value: number): string => (metric === 'tokens' ? formatTokensInMillions(value) : formatCost(value));

  return (
    <Card data-test="current-week-threshold-chart">
      <CardBody>
        {(hasTokenBudget || hasCostBudget) && (
          <ToggleGroup aria-label={t('Budget metric')} className={metricToggleStyle} isCompact>
            {hasTokenBudget && (
              <ToggleGroupItem
                aria-label={t('Tokens')}
                isSelected={metric === 'tokens'}
                onClick={() => setMetric('tokens')}
                text={t('Tokens')}
              />
            )}
            {hasCostBudget && (
              <ToggleGroupItem
                aria-label={t('Cost')}
                isSelected={metric === 'cost'}
                onClick={() => setMetric('cost')}
                text={t('Cost')}
              />
            )}
          </ToggleGroup>
        )}
        {lineData.length === 0 ? (
          <EmptyState headingLevel="h4" titleText={t('No usage recorded this period yet')}>
            <EmptyStateBody>
              {t('This view will populate after Chat AI usage is recorded for your user.')}
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <div className={thresholdWrapStyle} ref={wrapRef}>
            {width > 0 && (
              <Chart
                ariaDesc={t('Cumulative usage this week versus budget')}
                ariaTitle={t('Current week usage')}
                containerComponent={
                  <ChartVoronoiContainer
                    constrainToVisibleArea
                    labels={({ datum }) => `${datum.name}: ${formatY(datum.y)}`}
                  />
                }
                height={260}
                maxDomain={{ y: maxY * 1.1 || 1 }}
                padding={{ bottom: 70, left: 80, right: 30, top: 20 }}
                width={width}
              >
                <ChartAxis
                  tickFormat={(tick: Date) => formatTick(new Date(tick))}
                  style={{ tickLabels: { angle: -30, fontSize: 10, padding: 8 } }}
                />
                <ChartAxis dependentAxis showGrid tickFormat={(tick: number) => formatY(tick)} />
                <ChartGroup>
                  <ChartLine data={lineData} style={{ data: { stroke: TOKEN_METRIC_COLORS.totalTokens } }} />
                  {thresholdData.length > 0 && (
                    <ChartThreshold data={thresholdData} style={{ data: { stroke: PFColors.Danger } }} />
                  )}
                </ChartGroup>
              </Chart>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
