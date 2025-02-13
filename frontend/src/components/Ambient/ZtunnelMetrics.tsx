import * as React from 'react';
import { Title, TitleSizes } from '@patternfly/react-core';
import { DurationInSeconds, TimeInMilliseconds } from '../../types/Common';
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

type ZtunnelMetricsProps = {
  cluster: string;
  duration: DurationInSeconds;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
};

export const ZtunnelMetrics: React.FC<ZtunnelMetricsProps> = (props: ZtunnelMetricsProps) => {
  const urlParams = new URLSearchParams(location.getSearch());
  const expandedChart = urlParams.get('expand') ?? undefined;
  const toolbarRef = React.createRef<HTMLDivElement>();
  const tabHeight = 300;
  const [metrics, setMetrics] = React.useState<DashboardModel>();
  const rateParams = computePrometheusRateParams(props.duration, 10);
  const direction: DirectionType = 'outbound';
  const options: IstioMetricsOptions = {
    direction: direction,
    duration: props.duration,
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
  }, []);

  // 20px (card margin) + 24px (card padding) + 51px (toolbar) + 15px (toolbar padding) + 24px (card padding) + 20px (card margin)
  //const toolbarHeight = toolbarRef.current ? toolbarRef.current.clientHeight : 51;
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
  /*
    let memorySeries: VCLine<RichDataPoint>[] = [];


    const ZtunnelMetricsChart = (m: ZtunnelMetricsMap|undefined): React.ReactNode => {
      if (m?.ztunnel_connections) {
        const data = toVCLine(m?.ztunnel_connections[0].datapoints, 'Mb', PFColors.Green400);
        memorySeries.push(data);
      }

      return (<>
        {m?.ztunnel_connections && (
            <Grid data-test="memory-chart" style={{ marginBottom: '1.25rem' }} hasGutter>
        <GridItem md={2}>
          <Flex
              className="pf-u-h-100-on-md"
              direction={{ md: 'column' }}
              spaceItems={{ md: 'spaceItemsNone' }}
              justifyContent={{ md: 'justifyContentCenter' }}
              style={{ textAlign: 'right', paddingRight: '2rem' }}
          >
            <FlexItem>
              <b>{t('Memory')}</b>
              <Tooltip
                  position={TooltipPosition.right}
                  content={
                    <div style={{ textAlign: 'left' }}>
                      {t('This chart shows memory consumption for the istiod {{memoryMetricSource}}', {

                      })}
                    </div>
                  }
              >
                <KialiIcon.Info className={infoStyle} />
              </Tooltip>
            </FlexItem>
          </Flex>
        </GridItem>

        <GridItem md={10}>
          <SparklineChart
              ariaTitle="Memory"
              name="memory"
              height={65}
              showLegend={false}
              showYAxis={true}
              padding={{ top: 10, left: 40, right: 10, bottom: 0 }}
              tooltipFormat={dp =>
                  `${(dp.x as Date).toLocaleStringWithConditionalDate()}\n${dp.y.toFixed(2)} ${dp.name}`
              }
              series={memorySeries}
              labelName={t('mb')}
          />
        </GridItem>
      </Grid>
        )}
      </>)
    }
  */
  return (
    <>
      <div>
        <Title headingLevel="h5" size={TitleSizes.lg} data-test="enrolled-data-title">
          Ztunnel metrics
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
        </Title>
      </div>
    </>
  );
};
