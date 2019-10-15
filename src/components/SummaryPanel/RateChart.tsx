import * as React from 'react';
import { Chart, ChartBar, ChartStack, ChartAxis, ChartTooltip } from '@patternfly/react-charts';
import { PfColors } from '../../components/Pf/PfColors';
import { SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';
import * as Legend from 'components/Charts/LegendHelper';

type RateChartGrpcPropType = {
  percentErr: number;
  percentOK: number;
};

type ValueData = Legend.LegendItem & {
  value: number;
};

const renderChartBars = (baseName: string, data: ValueData[]) => {
  let height = 80 + Legend.TOP_MARGIN + Legend.HEIGHT;
  const padding = {
    top: 10,
    left: 38,
    bottom: 20 + Legend.TOP_MARGIN + Legend.HEIGHT,
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
      domainPadding={{ x: [15, 15] }}
      domain={{ y: [0, 100] }}
      events={events}
    >
      <ChartStack colorScale={data.map(d => d.color)} horizontal={true}>
        {data.map((datum, idx) => {
          return (
            <ChartBar
              name={baseName + '-bars-' + idx}
              data={[
                { name: datum.name, x: 'rate', y: datum.value, label: `${datum.name}: ${datum.value.toFixed(2)} %` }
              ]}
              barWidth={30}
              labelComponent={<ChartTooltip constrainToVisibleArea={true} />}
            />
          );
        })}
      </ChartStack>
      <ChartAxis style={{ tickLabels: { fill: 'none' } }} />
      <ChartAxis dependentAxis={true} showGrid={true} crossAxis={false} tickValues={[0, 25, 50, 75, 100]} />
      {Legend.buildRateBarsLegend(baseName + '-legend', data, height, SUMMARY_PANEL_CHART_WIDTH)}
    </Chart>
  );
};

export class RateChartGrpc extends React.Component<RateChartGrpcPropType> {
  static defaultProps: RateChartGrpcPropType = {
    percentErr: 0,
    percentOK: 0
  };

  render() {
    const data = [
      { name: 'OK', value: this.props.percentOK, color: PfColors.Green400 },
      { name: 'Err', value: this.props.percentErr, color: PfColors.Red100 }
    ];
    return renderChartBars('rate-grpc', data);
  }
}

type RateChartHttpPropType = {
  percent2xx: number;
  percent3xx: number;
  percent4xx: number;
  percent5xx: number;
};

export class RateChartHttp extends React.Component<RateChartHttpPropType> {
  static defaultProps: RateChartHttpPropType = {
    percent2xx: 0,
    percent3xx: 0,
    percent4xx: 0,
    percent5xx: 0
  };

  render() {
    const data = [
      { name: 'OK', value: this.props.percent2xx, color: PfColors.Green400 },
      { name: '3xx', value: this.props.percent3xx, color: PfColors.Blue },
      { name: '4xx', value: this.props.percent4xx, color: PfColors.Orange400 },
      { name: '5xx', value: this.props.percent5xx, color: PfColors.Red100 }
    ];
    return renderChartBars('rate-http', data);
  }
}
