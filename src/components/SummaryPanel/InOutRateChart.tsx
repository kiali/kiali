import * as React from 'react';
import { StackedBarChart } from 'patternfly-react';
import { PfColors } from '../../components/Pf/PfColors';

type InOutRateChartPropType = {
  percent2xxIn: number;
  percent3xxIn: number;
  percent4xxIn: number;
  percent5xxIn: number;
  percent2xxOut: number;
  percent3xxOut: number;
  percent4xxOut: number;
  percent5xxOut: number;
  height?: number;
  showLegend?: boolean;
  legendPos?: string; // e.g. right, left
};

export default class InOutRateChart extends React.Component<InOutRateChartPropType> {
  static defaultProps: InOutRateChartPropType = {
    percent2xxIn: 0,
    percent3xxIn: 0,
    percent4xxIn: 0,
    percent5xxIn: 0,
    percent2xxOut: 0,
    percent3xxOut: 0,
    percent4xxOut: 0,
    percent5xxOut: 0,
    height: 150,
    showLegend: true,
    legendPos: 'bottom'
  };

  constructor(props: InOutRateChartPropType) {
    super(props);
  }

  render() {
    return (
      <StackedBarChart
        size={{ height: this.props.height }}
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
            categories: ['In', 'Out'],
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
            ['OK', this.props.percent2xxIn, this.props.percent2xxOut],
            ['3xx', this.props.percent3xxIn, this.props.percent3xxOut],
            ['4xx', this.props.percent4xxIn, this.props.percent4xxOut],
            ['5xx', this.props.percent5xxIn, this.props.percent5xxOut]
          ],
          // order: 'asc',
          colors: {
            OK: PfColors.Green,
            '3xx': PfColors.Blue,
            '4xx': PfColors.Orange,
            '5xx': PfColors.Red
          }
        }}
      />
    );
  }
}
