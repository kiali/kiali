import * as React from 'react';
import { StackedBarChart } from 'patternfly-react';
import { PfColors } from '../../components/Pf/PfColors';

type RateChartPropType = {
  percent2xx: number;
  percent3xx: number;
  percent4xx: number;
  percent5xx: number;
  height?: number;
  showLegend?: boolean;
  legendPos?: string; // e.g. right, left
};

export default class RateChart extends React.Component<RateChartPropType> {
  static defaultProps: RateChartPropType = {
    percent2xx: 0,
    percent3xx: 0,
    percent4xx: 0,
    percent5xx: 0,
    height: 100,
    showLegend: true,
    legendPos: 'bottom'
  };

  constructor(props: RateChartPropType) {
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
