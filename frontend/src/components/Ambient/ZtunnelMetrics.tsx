import * as React from 'react';
import { DirectionType, TimeInMilliseconds, TimeRange } from '../../types/Common';
import * as API from '../../services/Api';
import { addError } from '../../utils/AlertUtils';
import { computePrometheusRateParams } from '../../services/Prometheus';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { location, router } from 'app/History';
import { serverConfig } from '../../config';
import * as MetricsHelper from '../Metrics/Helper';
import { Dashboard } from '../Charts/Dashboard';
import { DashboardModel } from '../../types/Dashboards';
import { GrafanaLinks } from '../Metrics/GrafanaLinks';
import { Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { MetricsObjectTypes } from '../../types/Metrics';
import { GrafanaInfo } from '../../types/GrafanaInfo';
import { MessageType } from '../../types/NotificationCenter';
import { PersesInfo } from '../../types/PersesInfo';
import { PersesLinks } from '../Metrics/PersesLinks';
import { store } from '../../store/ConfigStore';
import { kialiStyle } from 'styles/StyleUtils';
import { noShrinkStyle, scrollableContentStyle } from 'styles/FlexStyles';

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
  const toolbarRef = React.createRef<HTMLDivElement>();
  const [metrics, setMetrics] = React.useState<DashboardModel>();
  const [grafanaInfo, setGrafanaInfo] = React.useState<GrafanaInfo>();
  const [persesInfo, setPersesInfo] = React.useState<PersesInfo>();
  const externalServices = store.getState().statusState.externalServices;

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
        addError('Could not fetch metrics.', error);
        throw error;
      });
  };

  const fetchGrafanaInfo = (): void => {
    if (externalServices.find(service => service.name.toLowerCase() === 'grafana')) {
      API.getGrafanaInfo()
        .then(grafanaInfo => {
          if (grafanaInfo) {
            setGrafanaInfo(grafanaInfo.data);
          }
        })
        .catch(err => {
          addError('Could not fetch Grafana info. Turning off links to Grafana.', err, false, MessageType.INFO);
        });
    }
  };

  const fetchPersesInfo = (): void => {
    if (externalServices.find(service => service.name.toLowerCase() === 'perses')) {
      API.getPersesInfo()
        .then(persesInfo => {
          if (persesInfo) {
            setPersesInfo(persesInfo.data);
          }
        })
        .catch(err => {
          addError('Could not fetch Perses info. Turning off links to Perses.', err, false, MessageType.INFO);
        });
    }
  };

  React.useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.rangeDuration, props.lastRefreshAt]);

  React.useEffect(() => {
    fetchGrafanaInfo();
    fetchPersesInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {(grafanaInfo || persesInfo) && (
          <div ref={toolbarRef} className={noShrinkStyle}>
            <Toolbar style={{ padding: 0, marginBottom: '1.25rem' }}>
              <ToolbarGroup>
                <ToolbarItem style={{ marginLeft: 'auto', paddingRight: '1.25rem' }}>
                  {grafanaInfo && (
                    <GrafanaLinks
                      links={grafanaInfo.externalLinks}
                      namespace={props.namespace}
                      object="ztunnel"
                      objectType={MetricsObjectTypes.ZTUNNEL}
                      datasourceUID={grafanaInfo.datasourceUID}
                    />
                  )}

                  {persesInfo && (
                    <PersesLinks
                      links={persesInfo.externalLinks}
                      namespace={props.namespace}
                      object="ztunnel"
                      objectType={MetricsObjectTypes.ZTUNNEL}
                      project={persesInfo.project}
                    />
                  )}
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
            onExpand={handleExpand}
            labelPrettifier={MetricsHelper.prettyLabelValues}
            showSpans={false}
          />
        )}
      </div>
    </div>
  );
};
