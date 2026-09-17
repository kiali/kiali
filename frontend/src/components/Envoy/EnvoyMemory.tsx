import * as React from 'react';
import { Alert, Button, ButtonVariant, Card, CardBody, Popover, Title, TitleSizes } from '@patternfly/react-core';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import { CustomMetrics } from 'components/Metrics/CustomMetrics';
import { getAppLabelName, getVersionLabelName } from 'config/ServerConfig';
import type { Workload } from 'types/Workload';
import type { EnvoyMemorySummary } from 'types/EnvoyMemory';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFFontWeight } from 'styles/PfTypography';
import { scrollableContentStyle, tabCardStyle, flexCardStyle } from 'styles/FlexStyles';
import { classes } from 'typestyle';
import {
  buildEnvoyMemoryQueryParams,
  envoyMemoryCauseDescription,
  envoyMemoryCauseLabel,
  envoyMemoryCauseStatus,
  formatEnvoyMemoryBytes,
  formatEnvoyMemoryUsage,
  formatEnvoyRequestRate,
  istioConfigurationScopingUrl
} from 'utils/EnvoyMemoryUtils';
import { t } from 'utils/I18nUtils';
import { createIcon, KialiIcon } from 'config/KialiIcon';

type EnvoyMemoryProps = {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  timeRange: TimeRange;
  workload: Workload;
};

const summaryStyle = kialiStyle({
  marginBottom: '1.25rem'
});

const helpIconStyle = kialiStyle({
  marginLeft: '0.5rem',
  verticalAlign: 'middle'
});

const linkRowStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  marginTop: '1rem'
});

const summaryMetricsStyle = kialiStyle({
  display: 'flex',
  flexWrap: 'nowrap',
  gap: '2rem',
  marginTop: '1rem',
  overflowX: 'auto'
});

const summaryMetricItemStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  minWidth: '8rem'
});

const summaryMetricLabelStyle = kialiStyle({
  fontWeight: PFFontWeight.BodyBold
});

const summaryMetricValueStyle = kialiStyle({
  fontVariantNumeric: 'tabular-nums'
});

const chartsSectionStyle = kialiStyle({
  marginTop: '1.25rem'
});

export const EnvoyMemory: React.FC<EnvoyMemoryProps> = (props: EnvoyMemoryProps) => {
  const [summary, setSummary] = React.useState<EnvoyMemorySummary>();
  const appLabelName = getAppLabelName(props.workload.labels);
  const verLabelName = getVersionLabelName(props.workload.labels);
  const app = appLabelName ? props.workload.labels[appLabelName] : '';
  const version = verLabelName ? props.workload.labels[verLabelName] : undefined;

  const fetchSummary = React.useCallback((): void => {
    API.getWorkloadEnvoyMemory(
      props.namespace,
      props.workload.name,
      buildEnvoyMemoryQueryParams(props.timeRange, props.lastRefreshAt),
      props.workload.cluster
    )
      .then(response => {
        setSummary(response.data);
      })
      .catch(error => {
        addError('Could not fetch Envoy memory summary.', error);
      });
  }, [props.lastRefreshAt, props.namespace, props.timeRange, props.workload.cluster, props.workload.name]);

  React.useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const helpBody = (
    <div style={{ maxWidth: '24rem', textAlign: 'left' }}>
      <p>
        {t(
          'Envoy memory can be high because of traffic or because of a large configuration pushed to the proxy. When memory is high with little traffic and many clusters, configuration scoping may help.'
        )}
      </p>
      <Button
        component="a"
        href={istioConfigurationScopingUrl()}
        target="_blank"
        rel="noopener noreferrer"
        variant={ButtonVariant.link}
        isInline
        icon={<KialiIcon.ExternalLink className={helpIconStyle} />}
      >
        {t('Istio configuration scoping')}
      </Button>
    </div>
  );

  return (
    <Card className={classes(flexCardStyle, tabCardStyle)} data-test="envoy-memory-tab">
      <CardBody>
        <div className={summaryStyle}>
          <Title headingLevel="h3" size={TitleSizes.md}>
            {t('Envoy memory')}
            <Popover bodyContent={helpBody}>
              <OutlinedQuestionCircleIcon className={helpIconStyle} />
            </Popover>
          </Title>

          {summary && (
            <>
              <Alert
                isInline
                customIcon={createIcon(envoyMemoryCauseStatus(summary.cause))}
                variant={summary.cause === 'ok' ? 'success' : 'warning'}
                title={envoyMemoryCauseLabel(summary.cause)}
                style={{ marginTop: '1rem' }}
              >
                {envoyMemoryCauseDescription(summary.cause)}
              </Alert>

              <div className={summaryMetricsStyle} data-test="envoy-memory-summary-metrics">
                <div className={summaryMetricItemStyle}>
                  <span className={summaryMetricLabelStyle}>{t('Allocated memory (max)')}</span>
                  <span className={summaryMetricValueStyle}>{formatEnvoyMemoryUsage(summary)}</span>
                </div>
                {summary.memoryThresholdBytes > 0 && (
                  <div className={summaryMetricItemStyle}>
                    <span className={summaryMetricLabelStyle}>{t('Warning threshold')}</span>
                    <span className={summaryMetricValueStyle}>
                      {formatEnvoyMemoryBytes(summary.memoryThresholdBytes)}
                    </span>
                  </div>
                )}
                <div className={summaryMetricItemStyle}>
                  <span className={summaryMetricLabelStyle}>{t('Active clusters (max)')}</span>
                  <span className={summaryMetricValueStyle}>{summary.activeClustersMax}</span>
                </div>
                <div className={summaryMetricItemStyle}>
                  <span className={summaryMetricLabelStyle}>{t('Request rate')}</span>
                  <span className={summaryMetricValueStyle}>{formatEnvoyRequestRate(summary)}</span>
                </div>
                <div className={summaryMetricItemStyle}>
                  <span className={summaryMetricLabelStyle}>{t('Active connections')}</span>
                  <span className={summaryMetricValueStyle}>{summary.activeConnections}</span>
                </div>
              </div>

              {summary.cause === 'configuration' && (
                <div className={linkRowStyle}>
                  <Button
                    component="a"
                    href={istioConfigurationScopingUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant={ButtonVariant.link}
                    isInline
                    icon={<KialiIcon.ExternalLink className={helpIconStyle} />}
                  >
                    {t('Learn about configuration scoping')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className={classes(scrollableContentStyle, chartsSectionStyle)}>
          <CustomMetrics
            app={app}
            appLabelName={appLabelName}
            chartsPerRow={2}
            data-test="envoy-memory-metrics"
            embedded={true}
            hideTraceSpans={true}
            lastRefreshAt={props.lastRefreshAt}
            namespace={props.namespace}
            template="envoy-memory"
            version={version}
            versionLabelName={verLabelName}
            workload={props.workload.name}
            workloadType={props.workload.gvk.Kind}
          />
        </div>
      </CardBody>
    </Card>
  );
};
