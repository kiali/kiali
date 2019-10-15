import * as React from 'react';
import { Chart, ChartBar, ChartStack, ChartAxis, ChartTooltip } from '@patternfly/react-charts';
import { PfColors } from '../../components/Pf/PfColors';
import { SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';
import * as Legend from 'components/Charts/LegendHelper';

type InOutRateChartGrpcPropType = {
  percentOkIn: number;
  percentErrIn: number;
  percentOkOut: number;
  percentErrOut: number;
};

type InOutData = Legend.LegendItem & {
  in: number;
  out: number;
};

const renderChartBars = (baseName: string, data: InOutData[]) => {
  let height = 132 + Legend.TOP_MARGIN + Legend.HEIGHT;
  const padding = {
    top: 15,
    left: 47,
    bottom: 30 + Legend.TOP_MARGIN + Legend.HEIGHT,
    right: 10
  };
  const events = Legend.events({
    items: data,
    itemBaseName: baseName + '-bars-',
    legendName: baseName + '-legend',
    onMouseOver: (_, props) => {
      return {
        style: { ...props.style, strokeWidth: 4, fillOpacity: 0.5 }
      };
    }
  });
  return (
    <Chart
      height={height}
      width={SUMMARY_PANEL_CHART_WIDTH}
      padding={padding}
      domainPadding={{ x: [30, 25] }}
      domain={{ y: [0, 100] }}
      events={events}
    >
      <ChartStack colorScale={data.map(d => d.color)} horizontal={true}>
        {data.map((datum, idx) => {
          return (
            <ChartBar
              name={baseName + '-bars-' + idx}
              data={[
                { name: datum.name, x: 'Out', y: datum.out, label: `${datum.name}: ${datum.out.toFixed(2)} %` },
                { name: datum.name, x: 'In', y: datum.in, label: `${datum.name}: ${datum.in.toFixed(2)} %` }
              ]}
              barWidth={30}
              labelComponent={<ChartTooltip constrainToVisibleArea={true} />}
            />
          );
        })}
      </ChartStack>
      <ChartAxis />
      <ChartAxis dependentAxis={true} showGrid={true} crossAxis={false} tickValues={[0, 25, 50, 75, 100]} />
      {Legend.buildRateBarsLegend(baseName + '-legend', data, height, SUMMARY_PANEL_CHART_WIDTH)}
    </Chart>
  );
};

export class InOutRateChartGrpc extends React.Component<InOutRateChartGrpcPropType> {
  static defaultProps: InOutRateChartGrpcPropType = {
    percentOkIn: 0,
    percentErrIn: 0,
    percentOkOut: 0,
    percentErrOut: 0
  };

  render() {
    const data = [
      { name: 'OK', in: this.props.percentOkIn, out: this.props.percentOkOut, color: PfColors.Green400 },
      { name: 'Err', in: this.props.percentErrIn, out: this.props.percentErrOut, color: PfColors.Red100 }
    ];
    return renderChartBars('in-out-grpc', data);
  }
}

type InOutRateChartHttpPropType = {
  percent2xxIn: number;
  percent3xxIn: number;
  percent4xxIn: number;
  percent5xxIn: number;
  percent2xxOut: number;
  percent3xxOut: number;
  percent4xxOut: number;
  percent5xxOut: number;
};

export class InOutRateChartHttp extends React.Component<InOutRateChartHttpPropType> {
  static defaultProps: InOutRateChartHttpPropType = {
    percent2xxIn: 0,
    percent3xxIn: 0,
    percent4xxIn: 0,
    percent5xxIn: 0,
    percent2xxOut: 0,
    percent3xxOut: 0,
    percent4xxOut: 0,
    percent5xxOut: 0
  };

  render() {
    const data = [
      { name: 'OK', in: this.props.percent2xxIn, out: this.props.percent2xxOut, color: PfColors.Green400 },
      { name: '3xx', in: this.props.percent3xxIn, out: this.props.percent3xxOut, color: PfColors.Blue },
      { name: '4xx', in: this.props.percent4xxIn, out: this.props.percent4xxOut, color: PfColors.Orange400 },
      { name: '5xx', in: this.props.percent5xxIn, out: this.props.percent5xxOut, color: PfColors.Red100 }
    ];
    return renderChartBars('in-out', data);
  }
}
