import * as React from 'react';
import {
  Alert,
  Bullseye,
  Button,
  ButtonVariant,
  Card,
  CardBody,
  CardTitle,
  Divider,
  EmptyState,
  EmptyStateBody,
  Flex,
  Grid,
  GridItem,
  Spinner,
  Title,
  TitleSizes
} from '@patternfly/react-core';
import { IRow, TableVariant } from '@patternfly/react-table';
import { LocalTime } from 'components/Time/LocalTime';
import { SimpleTable, SortableTh } from 'components/Table/SimpleTable';
import * as API from 'services/Api';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize, PFFontWeight } from 'styles/PfTypography';
import {
  AITimeSeriesEntry,
  ChatSessionUsageMetric,
  ChatSessionUsageResponse,
  formatCost,
  formatTokensInMillions
} from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import { KialiIcon } from 'config/KialiIcon';
import { onAIResponseReceived } from 'utils/aiEvents';
import { ClusterIcon, CogIcon, CubesIcon, DesktopIcon, MoneyBillIcon } from '@patternfly/react-icons';
import { useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { AIStats } from './AIStats';
import { BudgetBulletCard, CurrentWeekThresholdChart } from './AIUsageCharts';
import { getWeekNumber } from './AIStats/calculationData';
import { TokensMillionsValue } from './TokensMillionsValue';

const contentStyle = kialiStyle({
  minHeight: 0
});

const galleryStyle = kialiStyle({
  padding: PFSpacer.lg
});

const statLabelStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)',
  fontSize: PFFontSize.small,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
});

const statValueStyle = kialiStyle({
  fontSize: PFFontSize.large,
  fontWeight: PFFontWeight.BodyBold,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
});

const kpiRowStyle = kialiStyle({
  marginBottom: PFSpacer.sm
});

const noteStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)',
  marginBottom: PFSpacer.md
});

const columnTitleStyle = kialiStyle({
  marginBottom: PFSpacer.sm
});

const overlaySessionOnWeekSeries = (
  series: AITimeSeriesEntry[] | undefined,
  session: ChatSessionUsageMetric[]
): AITimeSeriesEntry[] | undefined => {
  if (session.length === 0) {
    return series;
  }

  const merged = (series ?? []).map(entry => ({ ...entry, points: [...entry.points] }));
  const now = new Date().toISOString();

  session.forEach(metric => {
    let entry = merged.find(item => item.provider === metric.provider && item.model === metric.model);
    if (!entry) {
      entry = { model: metric.model, points: [], provider: metric.provider };
      merged.push(entry);
    }

    const lastTs = entry.points[entry.points.length - 1]?.timestamp;
    if (lastTs && new Date(lastTs).getTime() > new Date(metric.since).getTime()) {
      return;
    }

    entry.points.push({
      completionTokens: metric.completion_tokens / 1_000_000,
      promptTokens: metric.prompt_tokens / 1_000_000,
      timestamp: now,
      totalTokens: metric.total_tokens / 1_000_000
    });
  });

  return merged;
};

const currentWeekSeries = (
  hourly: ChatSessionUsageResponse['currentPeriod'],
  weekly: ChatSessionUsageResponse['metrics'],
  session: ChatSessionUsageMetric[]
): AITimeSeriesEntry[] | undefined => {
  const hourlySeries = hourly?.timeSeries?.series ?? [];
  const hasHourly = hourlySeries.some(entry => entry.points.length > 0);
  if (hasHourly) {
    return overlaySessionOnWeekSeries(hourlySeries, session);
  }

  const week = getWeekNumber(new Date());
  const weeklySeries = (weekly?.timeSeries?.series ?? [])
    .map(entry => ({
      ...entry,
      points: entry.points.filter(point => getWeekNumber(new Date(point.timestamp)) === week)
    }))
    .filter(entry => entry.points.length > 0);

  return overlaySessionOnWeekSeries(weeklySeries.length > 0 ? weeklySeries : hourlySeries, session);
};

const columns: SortableTh[] = [
  { title: t('Provider'), sortable: false },
  { title: t('Model'), sortable: false },
  { title: t('Requests'), sortable: false },
  { title: t('Prompt Tokens (M)'), sortable: false },
  { title: t('Completion Tokens (M)'), sortable: false },
  { title: t('Total Tokens (M)'), sortable: false },
  { title: t('Since'), sortable: false },
  { title: t('Last Updated'), sortable: false }
];

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({
  icon,
  label,
  value
}) => (
  <Card isCompact>
    <CardBody>
      <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
        {icon}
        <span className={statLabelStyle}>{label}</span>
      </Flex>
      <div className={statValueStyle}>{value}</div>
    </CardBody>
  </Card>
);

class AIStatsErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[AIStats] Chart render error:', error);
  }
  render() {
    if (this.state.error) {
      return (
        <Alert variant="danger" title={t('Chart render error')} style={{ margin: PFSpacer.md }}>
          {this.state.error.message}
        </Alert>
      );
    }
    return this.props.children;
  }
}

export const AIUsage: React.FC = () => {
  const metricsEnabled = useSelector((state: KialiAppState) => !!state.ai.consumption?.enabled);
  const [session, setSession] = React.useState<ChatSessionUsageMetric[]>([]);
  const [usage, setUsage] = React.useState<ChatSessionUsageResponse['metrics']>();
  const [currentPeriod, setCurrentPeriod] = React.useState<ChatSessionUsageResponse['currentPeriod']>();
  const [budget, setBudget] = React.useState<ChatSessionUsageResponse['budget'] | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>('');

  const loadMetrics = React.useCallback(async (showSpinner = false): Promise<void> => {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const response = await API.getAISessionUsage();
      setSession(response.data.session || []);
      setUsage(response.data.metrics);
      setCurrentPeriod(response.data.currentPeriod);
      setBudget(response.data.budget);
      setError('');
    } catch (err) {
      setError(API.getErrorString(err as any));
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadMetrics(true);
  }, [loadMetrics]);

  React.useEffect(() => {
    return onAIResponseReceived(() => void loadMetrics(false));
  }, [loadMetrics]);

  const totals = React.useMemo(
    () =>
      session.reduce(
        (acc, metric) => {
          acc.requestCount += metric.request_count;
          acc.promptTokens += metric.prompt_tokens;
          acc.completionTokens += metric.completion_tokens;
          acc.totalTokens += metric.total_tokens;
          return acc;
        },
        { requestCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      ),
    [session]
  );

  const since = React.useMemo(() => {
    if (session.length === 0) {
      return '';
    }

    return [...session]
      .map(metric => metric.since)
      .filter(Boolean)
      .sort()[0];
  }, [session]);

  const rows: IRow[] = React.useMemo(
    () =>
      [...session]
        .sort((left, right) => right.total_tokens - left.total_tokens)
        .map(metric => ({
          cells: [
            metric.provider,
            metric.model,
            metric.request_count.toLocaleString(),
            <TokensMillionsValue value={metric.prompt_tokens} />,
            <TokensMillionsValue value={metric.completion_tokens} />,
            <TokensMillionsValue value={metric.total_tokens} />,
            <LocalTime time={metric.since} />,
            <LocalTime time={metric.last_updated} />
          ],
          key: `${metric.provider}-${metric.model}`
        })),
    [session]
  );

  const sessionEmptyState = (
    <EmptyState headingLevel="h4" titleText={t('No token stats yet')}>
      <EmptyStateBody>
        {t('This view will populate after you use Chat AI in the current Kiali session.')}
      </EmptyStateBody>
    </EmptyState>
  );

  const errorState = (
    <EmptyState headingLevel="h4" titleText={t('Unable to load token stats')}>
      <EmptyStateBody>{error}</EmptyStateBody>
    </EmptyState>
  );

  return (
    <div className={contentStyle} data-test="ai-usage-page">
      {loading ? (
        <Bullseye data-test="session-token-stats-loading">
          <Spinner size="xl" />
        </Bullseye>
      ) : error ? (
        errorState
      ) : (
        <>
          {metricsEnabled && budget?.has_budget && (
            <Grid hasGutter className={galleryStyle} data-test="ai-usage-budget">
              <GridItem span={12}>
                <Title headingLevel="h2" size={TitleSizes.xl} className={columnTitleStyle}>
                  {`${t('Budget')} (${budget.interval})`}
                </Title>
              </GridItem>
              <GridItem span={12} md={6}>
                <BudgetBulletCard
                  data-test="remaining-cost-bullet"
                  formatValue={formatCost}
                  icon={<MoneyBillIcon />}
                  label={t('Remaining cost')}
                  max={budget.max_cost}
                  remaining={budget.remaining_cost}
                />
              </GridItem>
              <GridItem span={12} md={6}>
                <BudgetBulletCard
                  data-test="remaining-tokens-bullet"
                  formatValue={formatTokensInMillions}
                  icon={<CubesIcon />}
                  label={t('Remaining tokens')}
                  max={budget.max_tokens}
                  remaining={budget.remaining_tokens}
                />
              </GridItem>
            </Grid>
          )}

          {metricsEnabled && budget?.has_budget && <Divider component="div" />}
          <Grid hasGutter className={galleryStyle} data-test="ai-usage-session-grid">
            <GridItem span={12} lg={metricsEnabled ? 6 : 12}>
              <Title headingLevel="h2" size={TitleSizes.xl} className={columnTitleStyle}>
                {t('Current session')}
              </Title>
              <div className={noteStyle}>
                {t(
                  'These token stats are scoped to your current Kiali session and stored in memory on the server. They reset when the server restarts or the session expires.'
                )}
              </div>
              {session.length === 0 ? (
                sessionEmptyState
              ) : (
                <>
                  <Grid hasGutter className={kpiRowStyle}>
                    <GridItem span={3}>
                      <SummaryCard
                        icon={<ClusterIcon />}
                        label={t('Requests')}
                        value={totals.requestCount.toLocaleString()}
                      />
                    </GridItem>
                    <GridItem span={3}>
                      <SummaryCard
                        icon={<DesktopIcon />}
                        label={t('Prompt (M)')}
                        value={<TokensMillionsValue value={totals.promptTokens} />}
                      />
                    </GridItem>
                    <GridItem span={3}>
                      <SummaryCard
                        icon={<CogIcon />}
                        label={t('Completion (M)')}
                        value={<TokensMillionsValue value={totals.completionTokens} />}
                      />
                    </GridItem>
                    <GridItem span={3}>
                      <SummaryCard
                        icon={<CubesIcon />}
                        label={t('Total (M)')}
                        value={<TokensMillionsValue value={totals.totalTokens} />}
                      />
                    </GridItem>
                  </Grid>
                  <div className={noteStyle}>
                    {t('Data calculated')} {t('Since')} {since ? <LocalTime time={since} /> : '-'}
                    <Button
                      icon={<KialiIcon.Sync />}
                      id="refresh-metrics"
                      variant={ButtonVariant.link}
                      onClick={() => void loadMetrics(false)}
                    />
                  </div>
                  <Card>
                    <CardTitle>{t('Usage by Provider and Model')}</CardTitle>
                    <CardBody>
                      <SimpleTable
                        label={t('Session token usage by provider and model')}
                        columns={columns}
                        rows={rows}
                        emptyState={sessionEmptyState}
                        variant={TableVariant.compact}
                      />
                    </CardBody>
                  </Card>
                </>
              )}
            </GridItem>
            {metricsEnabled && (
              <GridItem span={12} lg={6}>
                <Title headingLevel="h2" size={TitleSizes.xl} className={columnTitleStyle}>
                  {t('Current week usage')}
                </Title>
                <div className={noteStyle}>
                  {t(
                    'This chart shows Prometheus usage for the current week, from the start of the week through now. New Chat AI requests are included as soon as they are recorded.'
                  )}
                </div>
                <CurrentWeekThresholdChart budget={budget} series={currentWeekSeries(currentPeriod, usage, session)} />
              </GridItem>
            )}
          </Grid>

          {metricsEnabled && (
            <>
              <Divider component="div" />
              <AIStatsErrorBoundary>
                <AIStats
                  budget={budget}
                  hideTimeRange
                  summary={usage?.summary ?? null}
                  timeSeries={usage?.timeSeries ?? null}
                />
              </AIStatsErrorBoundary>
            </>
          )}
        </>
      )}
    </div>
  );
};
