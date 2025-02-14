import * as React from 'react';
import { TimeInMilliseconds, TimeRange } from '../../types/Common';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { location, router } from 'app/History';
import { DirectionType } from '../../pages/Overview/OverviewToolbar';
import { serverConfig } from '../../config';
import * as MetricsHelper from '../Metrics/Helper';
import { Dashboard } from '../Charts/Dashboard';
import { DashboardModel } from '../../types/Dashboards';
import { RenderComponentScroll } from '../Nav/Page';

type ZtunnelMetricsProps = {
  cluster: string;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  rangeDuration: TimeRange;
};

export const ZtunnelMetrics: React.FC<ZtunnelMetricsProps> = (props: ZtunnelMetricsProps) => {
  const urlParams = new URLSearchParams(location.getSearch());
  const expandedChart = urlParams.get('expand') ?? undefined;
  const toolbarRef = React.createRef<HTMLDivElement>();
  const [tabHeight, setTabHeight] = React.useState<number>(800);
  const [metrics, setMetrics] = React.useState<DashboardModel>();
  const rateParams = computePrometheusRateParams(
    props.rangeDuration.rangeDuration ? props.rangeDuration.rangeDuration : 60,
    10
  );
  const direction: DirectionType = 'outbound';
  const options: IstioMetricsOptions = {
    direction: direction,
    duration: props.rangeDuration.rangeDuration,
    filters: ['request_count', 'request_error_count'],
    includeAmbient: serverConfig.ambientEnabled,
    rateInterval: rateParams.rateInterval,
    reporter: 'source',
    step: rateParams.step
  };

  const fetchMetrics = (): Promise<void> => {
    return API.getZtunnelMetrics(props.namespace, 'ztunnel', options, props.cluster)
      .then(response => {
        setMetrics(response.data);
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch metrics.', error);
        throw error;
      });
  };

  React.useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.rangeDuration.rangeDuration]);

  const toolbarHeight = toolbarRef.current ? toolbarRef.current.clientHeight : 51;
  const toolbarSpace = 20 + 24 + toolbarHeight + 15 + 24 + 20;
  const settings = MetricsHelper.retrieveMetricsSettings(200);
  const dashboardHeight = tabHeight - toolbarSpace;

  const expandHandler = (expandedChart?: string): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.delete('expand');

    if (expandedChart) {
      urlParams.set('expand', expandedChart);
    }

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
  };

  return (
    <RenderComponentScroll onResize={height => setTabHeight(height)}>
      <div>
        {metrics && (
          <Dashboard
            dashboard={metrics}
            labelValues={MetricsHelper.convertAsPromLabels(settings.labelsSettings)}
            maximizedChart={expandedChart}
            expandHandler={expandHandler}
            labelPrettifier={MetricsHelper.prettyLabelValues}
            showSpans={false}
            dashboardHeight={dashboardHeight}
          />
        )}
      </div>
    </RenderComponentScroll>
  );
};
