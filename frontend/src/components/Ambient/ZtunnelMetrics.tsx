import * as React from 'react';
import type { DirectionType, TimeInMilliseconds, TimeRange } from '../../types/Common';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { computePrometheusRateParams } from '../../services/Prometheus';
import type { IstioMetricsOptions } from '../../types/MetricsOptions';
import { buildReporter } from '../../types/MetricsOptions';
import { location, router } from 'app/History';
import { serverConfig } from '../../config';
import * as MetricsHelper from '../Metrics/Helper';
import { Dashboard } from '../Charts/Dashboard';
import type { DashboardModel } from '../../types/Dashboards';
import { kialiStyle } from 'styles/StyleUtils';
import { scrollableContentStyle } from 'styles/FlexStyles';

type ZtunnelMetricsProps = {
  cluster: string;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  rangeDuration: TimeRange;
};

const metricsContainerStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0
});

export const ZtunnelMetrics: React.FC<ZtunnelMetricsProps> = (props: ZtunnelMetricsProps) => {
  const urlParams = new URLSearchParams(location.getSearch());
  const expandedChart = urlParams.get('expand') ?? undefined;
  const [metrics, setMetrics] = React.useState<DashboardModel>();

  const fetchMetrics = React.useCallback(async (): Promise<void> => {
    const rateParams = computePrometheusRateParams(
      props.rangeDuration.rangeDuration ? props.rangeDuration.rangeDuration : 60,
      10
    );
    const direction: DirectionType = 'outbound';
    const options: IstioMetricsOptions = {
      direction: direction,
      duration: props.rangeDuration.rangeDuration,
      filters: ['request_count', 'request_error_count'],
      rateInterval: rateParams.rateInterval,
      reporter: buildReporter(direction, serverConfig.ambientEnabled),
      step: rateParams.step
    };

    MetricsHelper.timeRangeToOptions(props.rangeDuration, options);
    const opts = { ...options };

    return API.getZtunnelDashboard(props.namespace, 'ztunnel', opts, props.cluster)
      .then(response => {
        setMetrics(response.data);
      })
      .catch(error => {
        addError('Could not fetch metrics.', error);
        throw error;
      });
  }, [props.cluster, props.lastRefreshAt, props.namespace, props.rangeDuration]);

  React.useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const settings = MetricsHelper.retrieveMetricsSettings(200);
  const handleExpand = (expandedChart?: string): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.delete('expand');

    if (expandedChart) {
      urlParams.set('expand', expandedChart);
    }

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
  };

  return (
    <div className={metricsContainerStyle}>
      <div className={scrollableContentStyle}>
        {metrics && (
          <Dashboard
            dashboard={metrics}
            labelValues={MetricsHelper.convertAsPromLabels(settings.labelsSettings)}
            maximizedChart={expandedChart}
            onExpand={handleExpand}
            labelPrettifier={MetricsHelper.prettyLabelValues}
            showSpans={false}
          />
        )}
      </div>
    </div>
  );
};
