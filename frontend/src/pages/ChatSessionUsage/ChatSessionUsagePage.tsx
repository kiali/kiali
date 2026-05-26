import * as React from 'react';
import {
  Bullseye,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  Gallery,
  Spinner
} from '@patternfly/react-core';
import { IRow, TableVariant } from '@patternfly/react-table';
import { LocalTime } from 'components/Time/LocalTime';
import { SimpleTable, SortableTh } from 'components/Table/SimpleTable';
import * as API from 'services/Api';
import { kialiStyle } from 'styles/StyleUtils';
import { ChatSessionUsageMetric } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

const contentStyle = kialiStyle({
  overflow: 'auto'
});

const galleryStyle = kialiStyle({
  padding: 'var(--pf-t--global--spacer--lg)'
});

const sectionStyle = kialiStyle({
  padding: '0 var(--pf-t--global--spacer--lg) var(--pf-t--global--spacer--lg) var(--pf-t--global--spacer--lg)'
});

const statValueStyle = kialiStyle({
  fontSize: 'var(--pf-t--global--font--size--2xl)',
  fontWeight: 700
});

const statLabelStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)'
});

const noteStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)'
});

const columns: SortableTh[] = [
  { title: t('Provider'), sortable: false },
  { title: t('Model'), sortable: false },
  { title: t('Requests'), sortable: false },
  { title: t('Prompt Tokens'), sortable: false },
  { title: t('Completion Tokens'), sortable: false },
  { title: t('Total Tokens'), sortable: false },
  { title: t('Since'), sortable: false },
  { title: t('Last Updated'), sortable: false }
];

const SummaryCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Card isCompact>
    <CardTitle>{label}</CardTitle>
    <CardBody>
      <div className={statValueStyle}>{value}</div>
      <div className={statLabelStyle}>{t('Current browser session')}</div>
    </CardBody>
  </Card>
);

export const ChatSessionUsageContent: React.FC = () => {
  const [metrics, setMetrics] = React.useState<ChatSessionUsageMetric[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    let isMounted = true;

    const loadMetrics = async (): Promise<void> => {
      try {
        const response = await API.getChatSessionUsage();
        if (!isMounted) {
          return;
        }
        setMetrics(response.data);
        setError('');
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(API.getErrorString(err as any));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  const totals = React.useMemo(
    () =>
      metrics.reduce(
        (acc, metric) => {
          acc.requestCount += metric.request_count;
          acc.promptTokens += metric.prompt_tokens;
          acc.completionTokens += metric.completion_tokens;
          acc.totalTokens += metric.total_tokens;
          return acc;
        },
        { requestCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      ),
    [metrics]
  );

  const since = React.useMemo(() => {
    if (metrics.length === 0) {
      return '';
    }

    return [...metrics]
      .map(metric => metric.since)
      .filter(Boolean)
      .sort()[0];
  }, [metrics]);

  const rows: IRow[] = React.useMemo(
    () =>
      [...metrics]
        .sort((left, right) => right.total_tokens - left.total_tokens)
        .map(metric => ({
          cells: [
            metric.provider,
            metric.model,
            metric.request_count.toLocaleString(),
            metric.prompt_tokens.toLocaleString(),
            metric.completion_tokens.toLocaleString(),
            metric.total_tokens.toLocaleString(),
            <LocalTime time={metric.since} />,
            <LocalTime time={metric.last_updated} />
          ],
          key: `${metric.provider}-${metric.model}`
        })),
    [metrics]
  );

  const emptyState = (
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
    <div className={contentStyle}>
      {loading ? (
        <Bullseye data-test="session-token-stats-loading">
          <Spinner size="xl" />
        </Bullseye>
      ) : error ? (
        errorState
      ) : (
        <>
          <Gallery hasGutter className={galleryStyle}>
            <SummaryCard label={t('Requests')} value={totals.requestCount.toLocaleString()} />
            <SummaryCard label={t('Prompt Tokens')} value={totals.promptTokens.toLocaleString()} />
            <SummaryCard label={t('Completion Tokens')} value={totals.completionTokens.toLocaleString()} />
            <SummaryCard label={t('Total Tokens')} value={totals.totalTokens.toLocaleString()} />
            <SummaryCard label={t('Since')} value={since ? <LocalTime time={since} /> : '-'} />
          </Gallery>

          <div className={sectionStyle}>
            <Card>
              <CardTitle>{t('Usage by Provider and Model')}</CardTitle>
              <CardBody>
                <SimpleTable
                  label={t('Session token usage by provider and model')}
                  columns={columns}
                  rows={rows}
                  emptyState={emptyState}
                  variant={TableVariant.compact}
                />
              </CardBody>
            </Card>
          </div>

          <div className={sectionStyle}>
            <Card>
              <CardTitle>{t('About these stats')}</CardTitle>
              <CardBody className={noteStyle}>
                {t(
                  'These token stats are scoped to your current Kiali session and stored in memory on the server. They reset when the server restarts or the session expires.'
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
