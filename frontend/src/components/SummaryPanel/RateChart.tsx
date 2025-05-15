import * as React from 'react';
import { Chart, ChartBar, ChartStack, ChartAxis, ChartTooltip, ChartLegend } from '@patternfly/react-charts/victory';

import { PFColors } from '../../components/Pf/PfColors';
import { SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';
import { RichDataPoint, VCLines } from 'types/VictoryChartInfo';
import { addLegendEvent, VCEvent } from 'utils/VictoryEvents';
import cssVariables from 'styles/variables.module.scss';

export const legendHeight = 25;
export const legendTopMargin = 20;

type Props = {
  baseName: string;
  series: VCLines<RichDataPoint>;
  height: number;
  xLabelsWidth: number;
};

type State = {
  hiddenSeries: Set<number>;
};

export class RateChart extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hiddenSeries: new Set() };
  }

  render() {
    const singleBar = this.props.series[0].datapoints.length === 1;
    let height = this.props.height + legendTopMargin + legendHeight;
    const padding = {
      top: singleBar ? 10 : 15,
      left: 5 + this.props.xLabelsWidth,
      bottom: 10 + legendTopMargin + legendHeight,
      right: 10
    };
    const events: VCEvent[] = [];
    this.props.series.forEach((_, idx) => {
      addLegendEvent(events, {
        legendName: this.props.baseName + '-legend',
        idx: idx,
        serieID: [this.props.baseName + '-bars-' + idx],
        onClick: __ => {
          // Same event can be fired for several targets, so make sure we only apply it once
          if (!this.state.hiddenSeries.delete(idx)) {
            // Was not already hidden => add to set
            this.state.hiddenSeries.add(idx);
          }
          this.setState({ hiddenSeries: new Set(this.state.hiddenSeries) });
          return null;
        },
        onMouseOver: props => {
          return {
            style: { ...props.style, strokeWidth: 4, fillOpacity: 0.5 }
          };
        }
      });
    });

    const fontSize = cssVariables.kialiFontSize;
    const fontSizePx = cssVariables.kialiFontSizePx;

    const horizontalAxisStyle = { tickLabels: { fill: PFColors.Color100, fontSize: fontSize, padding: 3 } };
    const verticalAxisStyle = singleBar
      ? { tickLabels: { fill: 'none', fontSize: fontSize } }
      : { tickLabels: { fill: PFColors.Color100, fontSize: fontSize, padding: 2 } };

    return (
      <Chart
        height={height}
        width={SUMMARY_PANEL_CHART_WIDTH}
        padding={padding}
        domainPadding={{ x: singleBar ? [15, 15] : [30, 25] }}
        domain={{ y: [0, 100] }}
        events={events as any[]}
      >
        <ChartStack
          colorScale={this.props.series
            .filter((_, idx) => !this.state.hiddenSeries.has(idx))
            .map(d => d.color || 'black')}
          horizontal={true}
        >
          {this.props.series.map((datum, idx) => {
            if (this.state.hiddenSeries.has(idx)) {
              return undefined;
            }
            return (
              <ChartBar
                key={this.props.baseName + '-bars-' + idx}
                name={this.props.baseName + '-bars-' + idx}
                data={datum.datapoints.map(dp => {
                  return {
                    ...dp,
                    label: `${dp.name}: ${dp.y.toFixed(2)} %`
                  };
                })}
                barWidth={10}
                labelComponent={
                  <ChartTooltip constrainToVisibleArea={true} flyoutStyle={{ stroke: 'none', fillOpacity: 0.6 }} />
                }
              />
            );
          })}
        </ChartStack>
        <ChartAxis style={verticalAxisStyle} />
        <ChartAxis
          style={horizontalAxisStyle}
          dependentAxis={true}
          showGrid={true}
          crossAxis={false}
          tickValues={[0, 25, 50, 75, 100]}
        />
        <ChartLegend
          style={{ labels: { fill: PFColors.Color100, fontSize: Number(fontSizePx) } }}
          name={this.props.baseName + '-legend'}
          data={this.props.series.map((s, idx) => {
            if (this.state.hiddenSeries.has(idx)) {
              return { ...s.legendItem, symbol: { fill: PFColors.Color200 } };
            }
            return s.legendItem;
          })}
          x={this.props.xLabelsWidth}
          y={height - legendHeight}
          height={legendHeight}
          width={SUMMARY_PANEL_CHART_WIDTH}
          gutter={14}
          symbolSpacer={8}
        />
      </Chart>
    );
  }
}

export const renderRateChartHttp = (
  percent2xx: number,
  percent3xx: number,
  percent4xx: number,
  percent5xx: number,
  percentNR: number
) => {
  const vcLines: VCLines<RichDataPoint> = [
    { name: 'OK', x: 'rate', y: percent2xx, color: PFColors.Success },
    { name: '3xx', x: 'rate', y: percent3xx, color: PFColors.Info },
    { name: '4xx', x: 'rate', y: percent4xx, color: PFColors.ChartWarning }, // 4xx client error, use close but distinct color
    { name: '5xx', x: 'rate', y: percent5xx, color: PFColors.ChartDanger },
    { name: 'No Response', x: 'rate', y: percentNR, color: PFColors.ChartOther } // No Response, just use black
  ].map(dp => {
    return {
      datapoints: [dp],
      color: dp.color,
      legendItem: {
        name: dp.name === 'No Response' ? 'NR' : dp.name,
        symbol: { fill: dp.color }
      }
    };
  });
  return <RateChart baseName={'rate-http'} height={80} xLabelsWidth={0} series={vcLines} />;
};

export const renderRateChartGrpc = (percentOK: number, percentErr: number) => {
  const vcLines: VCLines<RichDataPoint> = [
    { name: 'OK', x: 'rate', y: percentOK, color: PFColors.Success },
    { name: 'Err', x: 'rate', y: percentErr, color: PFColors.Danger }
  ].map(dp => {
    return {
      datapoints: [dp],
      color: dp.color,
      legendItem: {
        name: dp.name,
        symbol: { fill: dp.color }
      }
    };
  });
  return <RateChart baseName={'rate-grpc'} height={80} xLabelsWidth={0} series={vcLines} />;
};

export const renderInOutRateChartHttp = (
  percent2xxIn: number,
  percent3xxIn: number,
  percent4xxIn: number,
  percent5xxIn: number,
  percentNRIn: number,
  percent2xxOut: number,
  percent3xxOut: number,
  percent4xxOut: number,
  percent5xxOut: number,
  percentNROut: number
) => {
  const vcLines: VCLines<RichDataPoint> = [
    {
      name: 'OK',
      dp: [
        { x: 'In', y: percent2xxIn },
        { x: 'Out', y: percent2xxOut }
      ],
      color: PFColors.Success
    },
    {
      name: '3xx',
      dp: [
        { x: 'In', y: percent3xxIn },
        { x: 'Out', y: percent3xxOut }
      ],
      color: PFColors.Info
    },
    {
      name: '4xx',
      dp: [
        { x: 'In', y: percent4xxIn },
        { x: 'Out', y: percent4xxOut }
      ],
      color: PFColors.ChartWarning
    }, // 4xx client error, use close but distinct color
    {
      name: '5xx',
      dp: [
        { x: 'In', y: percent5xxIn },
        { x: 'Out', y: percent5xxOut }
      ],
      color: PFColors.ChartDanger
    },
    {
      name: 'No Response',
      dp: [
        { x: 'In', y: percentNRIn },
        { x: 'Out', y: percentNROut }
      ],
      color: PFColors.ChartOther
    } // No Response error, just use black
  ].map(line => {
    return {
      datapoints: line.dp.map(dp => ({
        name: line.name,
        color: line.color,
        ...dp
      })),
      color: line.color,
      legendItem: {
        name: line.name === 'No Response' ? 'NR' : line.name,
        symbol: { fill: line.color }
      }
    };
  });
  return <RateChart baseName={'in-out-rate-http'} height={80} xLabelsWidth={25} series={vcLines} />;
};

export const renderInOutRateChartGrpc = (
  percentOKIn: number,
  percentErrIn: number,
  percentOKOut: number,
  percentErrOut: number
) => {
  const vcLines: VCLines<RichDataPoint> = [
    {
      name: 'OK',
      dp: [
        { x: 'In', y: percentOKIn },
        { x: 'Out', y: percentOKOut }
      ],
      color: PFColors.Success
    },
    {
      name: 'Err',
      dp: [
        { x: 'In', y: percentErrIn },
        { x: 'Out', y: percentErrOut }
      ],
      color: PFColors.Danger
    }
  ].map(line => {
    return {
      datapoints: line.dp.map(dp => ({
        name: line.name,
        color: line.color,
        ...dp
      })),
      color: line.color,
      legendItem: {
        name: line.name,
        symbol: { fill: line.color }
      }
    };
  });
  return <RateChart baseName={'in-out-rate-grpc'} height={132} xLabelsWidth={25} series={vcLines} />;
};
