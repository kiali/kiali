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
import { GrafanaLinks } from '../Metrics/GrafanaLinks';
import { Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { MetricsObjectTypes } from '../../types/Metrics';
import { GrafanaInfo } from '../../types/GrafanaInfo';
import { MessageType } from '../../types/MessageCenter';

type ZtunnelMetricsProps = {
  cluster: string;
  dashboardHeight: number;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  rangeDuration: TimeRange;
};

export const ZtunnelMetrics: React.FC<ZtunnelMetricsProps> = (props: ZtunnelMetricsProps) => {
  const urlParams = new URLSearchParams(location.getSearch());
  const expandedChart = urlParams.get('expand') ?? undefined;
  const toolbarRef = React.createRef<HTMLDivElement>();
  const [metrics, setMetrics] = React.useState<DashboardModel>();
  const [grafanaInfo, setGrafanaInfo] = React.useState<GrafanaInfo>();
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

  const fetchMetrics = async (): Promise<void> => {
    MetricsHelper.timeRangeToOptions(props.rangeDuration, options);
    let opts = { ...options };

    return API.getZtunnelDashboard(props.namespace, 'ztunnel', opts, props.cluster)
      .then(response => {
        setMetrics(response.data);
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch metrics.', error);
        throw error;
      });
  };

  const fetchGrafanaInfo = (): void => {
    API.getGrafanaInfo()
      .then(grafanaInfo => {
        if (grafanaInfo) {
          setGrafanaInfo(grafanaInfo.data);
        }
      })
      .catch(err => {
        AlertUtils.addMessage({
          ...AlertUtils.extractApiError('Could not fetch Grafana info. Turning off links to Grafana.', err),
          group: 'default',
          type: MessageType.INFO,
          showNotification: false
        });
      });
  };

  React.useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.rangeDuration, props.lastRefreshAt]);

  React.useEffect(() => {
    fetchGrafanaInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settings = MetricsHelper.retrieveMetricsSettings(200);
  const expandHandler = (expandedChart?: string): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.delete('expand');

    if (expandedChart) {
      urlParams.set('expand', expandedChart);
    }

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
  };

  return (
    <div>
      {grafanaInfo && (
        <div ref={toolbarRef}>
          <Toolbar style={{ padding: 0, marginBottom: '1.25rem' }}>
            <ToolbarGroup>
              <ToolbarItem style={{ marginLeft: 'auto', paddingRight: '1.25rem' }}>
                <GrafanaLinks
                  links={grafanaInfo.externalLinks}
                  namespace={props.namespace}
                  object="ztunnel"
                  objectType={MetricsObjectTypes.ZTUNNEL}
                  datasourceUID={grafanaInfo.datasourceUID}
                />
              </ToolbarItem>
            </ToolbarGroup>
          </Toolbar>
        </div>
      )}
      {metrics && (
        <Dashboard
          dashboard={metrics}
          labelValues={MetricsHelper.convertAsPromLabels(settings.labelsSettings)}
          maximizedChart={expandedChart}
          expandHandler={expandHandler}
          labelPrettifier={MetricsHelper.prettyLabelValues}
          showSpans={false}
          dashboardHeight={props.dashboardHeight}
        />
      )}
    </div>
  );
};
