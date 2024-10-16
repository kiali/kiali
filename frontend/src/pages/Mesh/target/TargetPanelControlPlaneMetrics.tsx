import * as React from 'react';
import { SparklineChart } from 'components/Charts/SparklineChart';
import { VCLine, RichDataPoint } from 'types/VictoryChartInfo';
import { PFColors } from 'components/Pf/PfColors';
import { toVCLine } from 'utils/VictoryChartsUtils';
import { Card, CardBody, Flex, FlexItem, Grid, GridItem, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { IstiodResourceThresholds } from 'types/IstioStatus';
import { useKialiTranslation } from 'utils/I18nUtils';
import { Datapoint, Metric } from 'types/Metrics';
import { kialiStyle } from 'styles/StyleUtils';

type ControlPlaneProps = {
  istiodContainerCpu?: Metric[];
  istiodContainerMemory?: Metric[];
  istiodProcessCpu?: Metric[];
  istiodProcessMemory?: Metric[];
  istiodResourceThresholds?: IstiodResourceThresholds;
  pilotLatency?: Metric[];
};

const infoStyle = kialiStyle({
  marginLeft: '0.25rem'
});

const showMetrics = (metrics: Metric[] | undefined): boolean => {
  // show metrics if metrics exists and some values at least are not zero
  if (
    metrics &&
    metrics.length > 0 &&
    metrics[0].datapoints.length > 0 &&
    metrics[0].datapoints.some(dp => Number(dp[1]) !== 0)
  ) {
    return true;
  }

  return false;
};

export const TargetPanelControlPlaneMetrics: React.FC<ControlPlaneProps> = (props: ControlPlaneProps) => {
  const { t } = useKialiTranslation();

  let memorySeries: VCLine<RichDataPoint>[] = [];
  let cpuSeries: VCLine<RichDataPoint>[] = [];
  let memoryThresholds: VCLine<RichDataPoint>[] = [];
  let cpuThresholds: VCLine<RichDataPoint>[] = [];

  // The CPU metric can be respresented by a container or a process metric. We need to check which one to use
  let cpuMetricSource = 'container';
  let cpu = props.istiodContainerCpu;

  if (!showMetrics(props.istiodContainerCpu)) {
    cpu = props.istiodProcessCpu;
    cpuMetricSource = 'process';
  }

  // The memory metric can be respresented by a container or a process metric. We need to check which one to use
  let memoryMetricSource = 'process';
  let memory = props.istiodContainerMemory;

  if (!showMetrics(props.istiodContainerMemory)) {
    memory = props.istiodProcessMemory;
    memoryMetricSource = 'container';
  }

  if (showMetrics(memory)) {
    if (memory && memory?.length > 0) {
      const data = toVCLine(memory[0].datapoints, 'Mb', PFColors.Green400);

      if (props.istiodResourceThresholds?.memory) {
        const datapoint0: Datapoint = [memory[0].datapoints[0][0], memory[0].datapoints[0][1]];
        datapoint0[1] = props.istiodResourceThresholds?.memory;

        const datapointn: Datapoint = [
          memory[0].datapoints[memory[0].datapoints.length - 1][0],
          memory[0].datapoints[memory[0].datapoints.length - 1][0]
        ];

        datapointn[1] = props.istiodResourceThresholds?.memory;
        const dataThre = toVCLine([datapoint0, datapointn], t('Mb (Threshold)'), PFColors.Green300);
        memoryThresholds.push(dataThre);
      }

      memorySeries.push(data);
    }
  }

  if (showMetrics(cpu)) {
    if (cpu && cpu?.length > 0) {
      const data = toVCLine(cpu[0].datapoints, t('cores'), PFColors.Green400);

      if (props.istiodResourceThresholds?.cpu) {
        const datapoint0: Datapoint = [cpu[0].datapoints[0][0], cpu[0].datapoints[0][1]];
        datapoint0[1] = props.istiodResourceThresholds?.cpu;

        const datapointn: Datapoint = [
          cpu[0].datapoints[cpu[0].datapoints.length - 1][0],
          cpu[0].datapoints[cpu[0].datapoints.length - 1][0]
        ];

        datapointn[1] = props.istiodResourceThresholds?.cpu;
        const dataThre = toVCLine([datapoint0, datapointn], t('cores'), PFColors.Green300);
        cpuThresholds.push(dataThre);
      }

      cpuSeries.push(data);
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div>
        <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>
          {t('Control plane metrics')}
        </div>
      </div>
      <div
        style={{
          width: '100%',
          verticalAlign: 'top'
        }}
      >
        <Card isPlain>
          <CardBody>
            {showMetrics(memory) && (
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
                              memoryMetricSource
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
                    thresholds={memoryThresholds}
                  />
                </GridItem>
              </Grid>
            )}

            {showMetrics(cpu) && (
              <Grid data-test="cpu-chart" hasGutter>
                <GridItem md={2}>
                  <Flex
                    className="pf-u-h-100-on-md"
                    direction={{ md: 'column' }}
                    spaceItems={{ md: 'spaceItemsNone' }}
                    justifyContent={{ md: 'justifyContentCenter' }}
                    style={{ textAlign: 'right', paddingRight: '2rem' }}
                  >
                    <FlexItem>
                      <b>{t('CPU')}</b>
                      <Tooltip
                        position={TooltipPosition.right}
                        content={
                          <div style={{ textAlign: 'left' }}>
                            {t('This chart shows cpu consumption for the istiod {{cpuMetricSource}}', {
                              cpuMetricSource
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
                    name="cpu"
                    height={65}
                    showLegend={false}
                    showYAxis={true}
                    showXAxisValues={true}
                    padding={{ top: 10, left: 40, right: 10, bottom: 0 }}
                    tooltipFormat={dp =>
                      `${(dp.x as Date).toLocaleStringWithConditionalDate()}\n${dp.y.toFixed(2)} ${dp.name}`
                    }
                    series={cpuSeries}
                    labelName={t('cores')}
                    thresholds={cpuThresholds}
                  />
                </GridItem>
              </Grid>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
