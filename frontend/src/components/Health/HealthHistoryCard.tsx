import * as React from 'react';
import { Card, CardBody, CardHeader, Spinner, Title, TitleSizes } from '@patternfly/react-core';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { HealthStatusRibbon } from './HealthStatusRibbon';
import { isHealthHistoryAvailable } from '../../config';
import { humanDurations, serverConfig } from '../../config/ServerConfig';
import { computePrometheusRateParams } from '../../services/Prometheus';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';
import type { Datapoint } from 'types/Metrics';
import type { HealthStatusHistoryQuery } from 'types/MetricsOptions';
import type { HealthHistoryType } from '../../services/Api';

type HealthHistoryCardProps = {
  cluster?: string;
  healthType: HealthHistoryType;
  name: string;
  namespace: string;
};

const healthHistoryDurations = [3600, 10800, 21600, 43200, 86400, 604800, 2592000];

const defaultDuration = 21600;

const cardHeaderStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%'
});

const emptyStateStyle = kialiStyle({
  color: 'var(--pf-t--color--gray--50)',
  fontSize: '0.85rem',
  padding: '1rem 0',
  textAlign: 'center'
});

export const HealthHistoryCard: React.FC<HealthHistoryCardProps> = ({
  cluster,
  healthType,
  name,
  namespace
}: HealthHistoryCardProps) => {
  const { t } = useKialiTranslation();
  const durationOptions = React.useMemo((): Record<string, string> => {
    const allDurations = humanDurations(serverConfig, t('Last'));
    const options: Record<string, string> = {};

    healthHistoryDurations.forEach(durationSeconds => {
      const label = allDurations[durationSeconds];
      if (label) {
        options[String(durationSeconds)] = label;
      }
    });

    return options;
  }, [t]);

  const [datapoints, setDatapoints] = React.useState<Datapoint[]>([]);
  const [duration, setDuration] = React.useState<number>(defaultDuration);
  const [endTime, setEndTime] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);

  const handleDurationSelect = (key: string): void => {
    setDuration(Number(key));
    setLoading(true);
  };

  React.useEffect(() => {
    if (!isHealthHistoryAvailable()) {
      setLoading(false);
      return;
    }

    let active = true;
    const queryEnd = Math.floor(Date.now() / 1000);
    setEndTime(queryEnd);

    const rateParams = computePrometheusRateParams(duration, 100);
    const options: HealthStatusHistoryQuery = {
      duration: duration,
      step: rateParams.step
    };

    API.getHealthStatusHistory(namespace, healthType, name, options, cluster)
      .then(response => {
        if (!active) {
          return;
        }
        const data = response.data;
        if (data && data.length > 0 && data[0].datapoints) {
          setDatapoints(data[0].datapoints);
        } else {
          setDatapoints([]);
        }
      })
      .catch(error => {
        if (!active) {
          return;
        }
        addError(t('Could not fetch health status history.'), error);
        setDatapoints([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [cluster, duration, healthType, name, namespace, t]);

  if (!isHealthHistoryAvailable()) {
    return null;
  }

  const startTime = endTime > 0 ? endTime - duration : 0;
  const step = computePrometheusRateParams(duration, 100).step;

  return (
    <Card isCompact data-test="health-history-card">
      <CardHeader>
        <div className={cardHeaderStyle}>
          <Title headingLevel="h4" size={TitleSizes.md}>
            {t('Health History')}
          </Title>
          <ToolbarDropdown
            id="health-history-duration"
            handleSelect={handleDurationSelect}
            value={String(duration)}
            label={durationOptions[String(duration)]}
            options={durationOptions}
          />
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className={emptyStateStyle}>
            <Spinner size="md" />
          </div>
        ) : datapoints.length > 0 ? (
          <HealthStatusRibbon datapoints={datapoints} endTime={endTime} startTime={startTime} step={step} />
        ) : (
          <div className={emptyStateStyle}>{t('No health history available.')}</div>
        )}
      </CardBody>
    </Card>
  );
};
