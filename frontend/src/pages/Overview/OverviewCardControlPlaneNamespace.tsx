import * as React from 'react';

import { Datapoint, Metric } from '../../types/Metrics';

import 'components/Charts/Charts.css';
import { SparklineChart } from 'components/Charts/SparklineChart';
import { VCLine, RichDataPoint } from 'types/VictoryChartInfo';
import { PFColors } from 'components/Pf/PfColors';
import { toVCLine } from 'utils/VictoryChartsUtils';
import { DurationInSeconds } from 'types/Common';
import { getName } from 'utils/RateIntervals';
import { Card, CardBody, Flex, FlexItem, Grid, GridItem, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { style } from 'typestyle';
import { IstiodResourceThresholds } from 'types/IstioStatus';

export const infoStyle = style({
    margin: '0px 0px -1px 4px'
});

type ControlPlaneProps = {
    pilotLatency?: Metric[];
    istiodMemory?: Metric[];
    istiodCpu?: Metric[];
    duration: DurationInSeconds;
    istiodResourceThreholds?: IstiodResourceThresholds;
};

function showMetrics(metrics: Metric[] | undefined): boolean {
    // show metrics if metrics exists and some values at least are not zero
    if (metrics && metrics.length > 0 && metrics[0].datapoints.length > 0 && metrics[0].datapoints.some(dp => Number(dp[1]) !== 0)) {
        return true;
    }

    return false;
}

class OverviewCardControlPlaneNamespace extends React.Component<ControlPlaneProps, {}> {
    render() {
        let memorySeries: VCLine<RichDataPoint>[] = [];
        let cpuSeries: VCLine<RichDataPoint>[] = [];
        let memoryThresholds: VCLine<RichDataPoint>[] = [];
        let cpuThresholds: VCLine<RichDataPoint>[] = [];

        if (showMetrics(this.props.istiodMemory)) {
            if (this.props.istiodMemory && this.props.istiodMemory?.length > 0) {
                const data = toVCLine(this.props.istiodMemory[0].datapoints, 'Mb', PFColors.Green400);

                if (this.props.istiodResourceThreholds?.memory) {
                    const datapoint0: Datapoint = [this.props.istiodMemory[0].datapoints[0][0], this.props.istiodMemory[0].datapoints[0][1]];
                    datapoint0[1] = this.props.istiodResourceThreholds?.memory;
                    const datapointn: Datapoint = [this.props.istiodMemory[0].datapoints[this.props.istiodMemory[0].datapoints.length - 1][0], this.props.istiodMemory[0].datapoints[this.props.istiodMemory[0].datapoints.length - 1][0]];
                    datapointn[1] = this.props.istiodResourceThreholds?.memory;
                    const dataThre = toVCLine([datapoint0, datapointn], 'Mb (Threshold)', PFColors.Green300);
                    memoryThresholds.push(dataThre);
                }

                memorySeries.push(data);

            }
        }

        if (showMetrics(this.props.istiodCpu)) {
            if (this.props.istiodCpu && this.props.istiodCpu?.length > 0) {
                const data = toVCLine(this.props.istiodCpu[0].datapoints, 'cores', PFColors.Green400);

                if (this.props.istiodResourceThreholds?.cpu) {
                    const datapoint0: Datapoint = [this.props.istiodCpu[0].datapoints[0][0], this.props.istiodCpu[0].datapoints[0][1]];
                    datapoint0[1] = this.props.istiodResourceThreholds?.cpu;
                    const datapointn: Datapoint = [this.props.istiodCpu[0].datapoints[this.props.istiodCpu[0].datapoints.length - 1][0], this.props.istiodCpu[0].datapoints[this.props.istiodCpu[0].datapoints.length - 1][0]];
                    datapointn[1] = this.props.istiodResourceThreholds?.cpu;
                    const dataThre = toVCLine([datapoint0, datapointn], 'cores', PFColors.Green300);
                    cpuThresholds.push(dataThre);
                }

                cpuSeries.push(data);

            }
        }

        return (
            <div style={{ textAlign: 'center' }}>
                <div>
                    <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>Control plane metrics</div>
                </div>
                <div
                    style={{
                        width: '100%',
                        verticalAlign: 'top'
                    }}
                >
                    <Card isPlain>
                        <CardBody>
                            {showMetrics(this.props.istiodMemory) &&
                                <Grid style={{ marginBottom: 20 }} hasGutter>
                                    <GridItem md={2}>
                                        <Flex
                                            className="pf-u-h-100-on-md"
                                            direction={{ md: 'column' }}
                                            spaceItems={{ md: 'spaceItemsNone' }}
                                            justifyContent={{ md: 'justifyContentCenter' }}
                                            style={{ textAlign: "right", paddingRight: 30 }}
                                        >
                                            <FlexItem>
                                                <b>Memory</b>
                                            </FlexItem>
                                            <FlexItem>
                                                {getName(this.props.duration).toLowerCase()}
                                                <Tooltip
                                                    position={TooltipPosition.right}
                                                    content={<div style={{ textAlign: 'left' }}>This values represents the memory of the istiod process</div>}
                                                >
                                                    <KialiIcon.Info className={infoStyle} />
                                                </Tooltip>
                                            </FlexItem>
                                        </Flex>
                                    </GridItem>
                                    <GridItem md={10}>
                                        <SparklineChart
                                            ariaTitle='Memory'
                                            name={'memory'}
                                            height={65}
                                            showLegend={false}
                                            showYAxis={true}
                                            padding={{ top: 10, left: 40, right: 10, bottom: 0 }}
                                            tooltipFormat={dp => `${(dp.x as Date).toLocaleTimeString()}\n${dp.y.toFixed(2)} ${dp.name}`}
                                            series={memorySeries}
                                            labelName="mb"
                                            thresholds={memoryThresholds}
                                        />
                                    </GridItem>
                                </Grid>
                            }
                            {showMetrics(this.props.istiodCpu) &&
                                <Grid hasGutter>
                                    <GridItem md={2}>
                                        <Flex
                                            className="pf-u-h-100-on-md"
                                            direction={{ md: 'column' }}
                                            spaceItems={{ md: 'spaceItemsNone' }}
                                            justifyContent={{ md: 'justifyContentCenter' }}
                                            style={{ textAlign: "right", paddingRight: 30 }}
                                        >
                                            <FlexItem>
                                                <b>CPU</b>
                                            </FlexItem>
                                            <FlexItem>
                                                {getName(this.props.duration).toLowerCase()}
                                                <Tooltip
                                                    position={TooltipPosition.right}
                                                    content={<div style={{ textAlign: 'left' }}>This values represents cpu of the istiod process</div>}
                                                >
                                                    <KialiIcon.Info className={infoStyle} />
                                                </Tooltip>
                                            </FlexItem>
                                        </Flex>
                                    </GridItem>
                                    <GridItem md={10}>
                                        <SparklineChart
                                            name={'cpu'}
                                            height={65}
                                            showLegend={false}
                                            showYAxis={true}
                                            showXAxisValues={true}
                                            padding={{ top: 10, left: 40, right: 10, bottom: 0 }}
                                            tooltipFormat={dp => `${(dp.x as Date).toLocaleTimeString()}\n${dp.y.toFixed(2)} ${dp.name}`}
                                            series={cpuSeries}
                                            labelName="cores"
                                            thresholds={cpuThresholds}
                                        />
                                    </GridItem>
                                </Grid>
                            }
                        </CardBody>
                    </Card>
                </div>
            </div>
        );
    }
}

export default OverviewCardControlPlaneNamespace;
