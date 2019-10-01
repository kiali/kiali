import * as React from 'react';
import {
  Chart,
  ChartArea,
  ChartAxis,
  ChartVoronoiContainer,
  ChartScatter,
  ChartGroup,
  ChartTooltip
} from '@patternfly/react-charts';
import { InfoAltIcon } from '@patternfly/react-icons';
import { SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';
import Graphing from '../../utils/Graphing';
import { Datapoint } from '../../types/Metrics';
import { PfColors } from 'components/Pf/PfColors';

const { VictoryLegend } = require('victory');

export type ResponseTimeUnit = 's' | 'ms';
type ResponseTimeChartTypeProp = {
  hide?: boolean;
  label: string;
  rtAvg: Datapoint[];
  rtMed: Datapoint[];
  rt95: Datapoint[];
  rt99: Datapoint[];
  unit: ResponseTimeUnit;
};

export class ResponseTimeChart extends React.Component<ResponseTimeChartTypeProp, {}> {
  thereIsTrafficData = () => {
    return this.props.rtAvg.length > 0;
  };

  // The prom data may be in seconds but we want to report response times in millis when the user hovers
  // Convert the data points to millis.
  toMillis = (dps: Datapoint[]): Datapoint[] => {
    return dps.map(dp => [dp[0], dp[1] * 1000.0]);
  };

  render() {
    const scaler = this.props.unit === 's' ? this.toMillis : a => a;
    const series = [
      Graphing.toVCLine(scaler(this.props.rtAvg), 'avg', PfColors.Black),
      Graphing.toVCLine(scaler(this.props.rtMed), 'p50', PfColors.Green400),
      Graphing.toVCLine(scaler(this.props.rt95), 'p95', PfColors.Blue),
      Graphing.toVCLine(scaler(this.props.rt99), 'p99', PfColors.Orange400)
    ];

    const tooltip = (
      <ChartTooltip
        style={{ stroke: 'none' }}
        flyoutStyle={{ fillOpacity: 0.8 }}
        renderInPortal={true}
        constrainToVisibleArea={true}
      />
    );
    const container = (
      <ChartVoronoiContainer
        labels={obj => {
          if (obj.datum.childName.startsWith('rt-scatter')) {
            return null as any;
          }
          const val = Math.floor(obj.datum.y * 1000) / 1000;
          return `${(obj.datum.x as Date).toLocaleTimeString()} - ${obj.datum.name}: ${val} ms`;
        }}
        labelComponent={tooltip}
      />
    );

    const events = series.map((_, idx) => {
      return {
        childName: ['rt-legend'],
        target: ['data', 'labels'],
        eventKey: String(idx),
        eventHandlers: {
          onMouseOver: () => {
            return [
              {
                childName: ['rt-chart-' + idx],
                target: 'data',
                eventKey: 'all',
                mutation: props => {
                  return {
                    style: Object.assign({}, props.style, { strokeWidth: 4, fillOpacity: 0.5 })
                  };
                }
              }
            ];
          },
          onMouseOut: () => {
            return [
              {
                childName: ['rt-chart-' + idx],
                target: 'data',
                eventKey: 'all',
                mutation: () => {
                  return null;
                }
              }
            ];
          }
        }
      };
    });
    const hiddenAxisStyle = {
      axis: { stroke: 'none' },
      ticks: { stroke: 'none' },
      tickLabels: { stroke: 'none', fill: 'none' }
    };
    return (
      <>
        {!this.props.hide && (
          <div>
            <div>
              <strong>{this.props.label}:</strong>
            </div>
            {this.thereIsTrafficData() ? (
              <Chart
                containerComponent={container}
                height={100}
                width={SUMMARY_PANEL_CHART_WIDTH}
                padding={{
                  bottom: 30, // Adjusted to accommodate legend
                  top: 5
                }}
                events={events}
              >
                <ChartAxis tickCount={15} style={hiddenAxisStyle} />
                <ChartAxis dependentAxis={true} style={hiddenAxisStyle} />
                {series.map((serie, idx) => {
                  return (
                    <ChartGroup key={'serie-' + idx}>
                      <ChartScatter
                        name={'rt-scatter-' + idx}
                        data={serie.datapoints}
                        style={{ data: { fill: serie.color } }}
                        size={({ active }) => (active ? 5 : 2)}
                      />
                      <ChartArea
                        name={'rt-chart-' + idx}
                        data={serie.datapoints}
                        style={{
                          data: {
                            fill: serie.color,
                            fillOpacity: 0.2,
                            stroke: serie.color,
                            strokeWidth: 2
                          }
                        }}
                      />
                    </ChartGroup>
                  );
                })}
                <VictoryLegend name={'rt-legend'} data={series.map(s => s.legendItem)} y={70} />
              </Chart>
            ) : (
              <div>
                <InfoAltIcon /> Not enough traffic to generate chart.
              </div>
            )}
          </div>
        )}
      </>
    );
  }
}
