import * as React from 'react';
import { Card, CardBody, CardHeader, Spinner, Title, TitleSizes } from '@patternfly/react-core';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { PFColors } from 'components/Pf/PfColors';
import { HealthStatusRibbon } from './HealthStatusRibbon';
import { isHealthHistoryAvailable } from '../../config';
import { serverConfig } from '../../config/ServerConfig';
import { computePrometheusRateParams } from '../../services/Prometheus';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { useRefreshInterval } from 'hooks/refresh';
import { formatLastDuration, useKialiTranslation } from 'utils/I18nUtils';
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

const preferredDuration = 21600;

const buildHealthHistoryDurationOptions = (): Record<string, string> => {
  const options: Record<string, string> = {};

  healthHistoryDurations.forEach(durationSeconds => {
    const durationLabel = serverConfig.durations[durationSeconds];
    if (durationLabel) {
      options[String(durationSeconds)] = formatLastDuration(durationLabel);
    }
  });

  return options;
};

const getDefaultHealthHistoryDuration = (options: Record<string, string>): number | undefined => {
  if (options[String(preferredDuration)]) {
    return preferredDuration;
  }

  for (let i = healthHistoryDurations.length - 1; i >= 0; i--) {
    const candidate = healthHistoryDurations[i];
    if (options[String(candidate)]) {
      return candidate;
    }
  }

  return undefined;
};

const cardHeaderStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
  width: '100%'
});

const emptyStateStyle = kialiStyle({
  color: PFColors.Color200,
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
  const { lastRefreshAt } = useRefreshInterval();
  const { i18n, t } = useKialiTranslation();
  const durationOptions = React.useMemo(() => buildHealthHistoryDurationOptions(), [i18n.language]);

  const [datapoints, setDatapoints] = React.useState<Datapoint[]>([]);
  const [duration, setDuration] = React.useState<number>(preferredDuration);
  const [endTime, setEndTime] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);

  const resolvedDuration = React.useMemo((): number | undefined => {
    if (durationOptions[String(duration)] !== undefined) {
      return duration;
    }
    return getDefaultHealthHistoryDuration(durationOptions);
  }, [duration, durationOptions]);

  const queryStep = React.useMemo((): number | undefined => {
    if (resolvedDuration === undefined) {
      return undefined;
    }
    return computePrometheusRateParams(resolvedDuration, 100).step;
  }, [resolvedDuration]);

  const handleDurationSelect = (key: string): void => {
    setDuration(Number(key));
    setLoading(true);
  };

  React.useEffect(() => {
    if (resolvedDuration === undefined || durationOptions[String(duration)] !== undefined) {
      return;
    }
    setDuration(resolvedDuration);
    setLoading(true);
  }, [duration, durationOptions, resolvedDuration]);

  React.useEffect(() => {
    if (!isHealthHistoryAvailable()) {
      setLoading(false);
      return;
    }

    if (resolvedDuration === undefined || queryStep === undefined) {
      setDatapoints([]);
      setLoading(false);
      return;
    }

    let active = true;
    const queryEnd = Math.floor(Date.now() / 1000);
    setEndTime(queryEnd);

    const options: HealthStatusHistoryQuery = {
      duration: resolvedDuration,
      step: queryStep
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
  }, [cluster, healthType, lastRefreshAt, name, namespace, queryStep, resolvedDuration, t]);

  if (!isHealthHistoryAvailable()) {
    return null;
  }

  const startTime = endTime > 0 && resolvedDuration !== undefined ? endTime - resolvedDuration : 0;
  const step = queryStep ?? 0;

  return (
    <Card isCompact data-test="health-history-card">
      <CardHeader>
        <div className={cardHeaderStyle}>
          <Title headingLevel="h4" size={TitleSizes.md}>
            {t('Health History')}
          </Title>
          {resolvedDuration !== undefined && (
            <ToolbarDropdown
              id="health-history-duration"
              handleSelect={handleDurationSelect}
              label={durationOptions[String(resolvedDuration)]}
              options={durationOptions}
              value={String(resolvedDuration)}
            />
          )}
        </div>
      </CardHeader>
      <CardBody>
        {resolvedDuration === undefined ? (
          <div className={emptyStateStyle}>{t('No health history available.')}</div>
        ) : loading ? (
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
