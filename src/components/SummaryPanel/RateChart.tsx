import * as React from 'react';
import { StackedBarChart } from 'patternfly-react';
import { PfColors } from '../../components/Pf/PfColors';
import { LegendPosition, SUMMARY_PANEL_CHART_WIDTH } from '../../types/Graph';

type RateChartGrpcPropType = {
  height?: number;
  legendPos?: LegendPosition;
  percentErr: number;
  percentOK: number;
  showLegend?: boolean;
  width?: number;
};

export class RateChartGrpc extends React.Component<RateChartGrpcPropType> {
  static defaultProps: RateChartGrpcPropType = {
    height: 100,
    legendPos: 'bottom',
    percentErr: 0,
    percentOK: 0,
    showLegend: true,
    width: SUMMARY_PANEL_CHART_WIDTH
  };

  render() {
    return (
      <StackedBarChart
        size={{ height: this.props.height, width: this.props.width }}
        legend={{ show: this.props.showLegend, position: this.props.legendPos }}
        grid={{
          x: {
            show: false
          },
          y: {
            show: true
          }
        }}
        axis={{
          rotated: true,
          x: {
            categories: [''],
            type: 'category'
          },
          y: {
            show: true,
            inner: false,
            label: {
              text: '%',
              position: 'inner-right'
            },
            min: 0,
            max: 100,
            tick: {
              values: [0, 25, 50, 75, 100]
            },
            padding: {
              top: 20,
              bottom: 0
            }
          }
        }}
        data={{
          groups: [['OK', 'Err']],
          columns: [['OK', this.props.percentOK], ['Err', this.props.percentErr]],
          // order: 'asc',
          colors: {
            OK: PfColors.Green400,
            Err: PfColors.Red100
          }
        }}
      />
    );
  }
}

type RateChartHttpPropType = {
  height?: number;
  legendPos?: string; // e.g. right, left
  percent2xx: number;
  percent3xx: number;
  percent4xx: number;
  percent5xx: number;
  showLegend?: boolean;
  width?: number;
};

export class RateChartHttp extends React.Component<RateChartHttpPropType> {
  static defaultProps: RateChartHttpPropType = {
    height: 100,
    legendPos: 'bottom',
    percent2xx: 0,
    percent3xx: 0,
    percent4xx: 0,
    percent5xx: 0,
    showLegend: true,
    width: SUMMARY_PANEL_CHART_WIDTH
  };

  render() {
    return (
      <StackedBarChart
        size={{ height: this.props.height, width: this.props.width }}
        legend={{ show: this.props.showLegend, position: this.props.legendPos }}
        grid={{
          x: {
            show: false
          },
          y: {
            show: true
          }
        }}
        axis={{
          rotated: true,
          x: {
            categories: [''],
            type: 'category'
          },
          y: {
            show: true,
            inner: false,
            label: {
              text: '%',
              position: 'inner-right'
            },
            min: 0,
            max: 100,
            tick: {
              values: [0, 25, 50, 75, 100]
            },
            padding: {
              top: 20,
              bottom: 0
            }
          }
        }}
        data={{
          groups: [['OK', '3xx', '4xx', '5xx']],
          columns: [
            ['OK', this.props.percent2xx],
            ['3xx', this.props.percent3xx],
            ['4xx', this.props.percent4xx],
            ['5xx', this.props.percent5xx]
          ],
          // order: 'asc',
          colors: {
            OK: PfColors.Green400,
            '3xx': PfColors.Blue,
            '4xx': PfColors.Orange400,
            '5xx': PfColors.Red100
          }
        }}
      />
    );
  }
}
