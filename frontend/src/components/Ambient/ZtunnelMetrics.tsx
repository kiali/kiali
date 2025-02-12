import * as React from 'react';
import { Title, TitleSizes } from '@patternfly/react-core';
import { location, router } from '../../app/History';
import * as MetricsHelper from '../Metrics/Helper';
import { TimeInMilliseconds } from '../../types/Common';
import { Dashboard } from '../Charts/Dashboard';
import { DashboardModel } from '../../types/Dashboards';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { MetricsReporter } from '../MetricsOptions/MetricsReporter';

type ZtunnelMetricsProps = {
  cluster: string;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
};

export const ZtunnelMetrics: React.FC<ZtunnelMetricsProps> = (props: ZtunnelMetricsProps) => {
  const urlParams = new URLSearchParams(location.getSearch());
  const expandedChart = urlParams.get('expand') ?? undefined;
  const toolbarRef = React.createRef<HTMLDivElement>();
  const tabHeight = 300;
  const [dashboard, setDashboard] = React.useState<DashboardModel>();

  const fetchMetrics = (): Promise<void> => {
    const options: IstioMetricsOptions = {
      direction: 'inbound',
      includeAmbient: true,
      reporter: MetricsReporter.initialReporter('inbound')
    };

    return API.getWorkloadDashboard(props.namespace, 'ztunnel', options, props.cluster)
      .then(response => {
        setDashboard(response.data);
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch metrics.', error);
        throw error;
      });
  };

  React.useEffect(() => {
    fetchMetrics();
  }, []);

  // 20px (card margin) + 24px (card padding) + 51px (toolbar) + 15px (toolbar padding) + 24px (card padding) + 20px (card margin)
  const toolbarHeight = toolbarRef.current ? toolbarRef.current.clientHeight : 51;
  const toolbarSpace = 20 + 24 + toolbarHeight + 15 + 24 + 20;
  const dashboardHeight = tabHeight - toolbarSpace;
  const settings = MetricsHelper.retrieveMetricsSettings(20);

  const expandHandler = (expandedChart?: string): void => {
    const urlParams = new URLSearchParams(location.getSearch());
    urlParams.delete('expand');

    if (expandedChart) {
      urlParams.set('expand', expandedChart);
    }

    router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
  };

  return (
    <>
      <div>
        <Title headingLevel="h5" size={TitleSizes.lg} data-test="enrolled-data-title">
          Ztunnel metrics
          {dashboard && (
            <Dashboard
              dashboard={dashboard}
              labelValues={MetricsHelper.convertAsPromLabels(settings.labelsSettings)}
              maximizedChart={expandedChart}
              expandHandler={expandHandler}
              labelPrettifier={MetricsHelper.prettyLabelValues}
              showSpans={false}
              showTrendlines={false}
              dashboardHeight={dashboardHeight}
            />
          )}
        </Title>
      </div>
    </>
  );
};
