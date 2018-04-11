import * as React from 'react';
import { PieChart } from 'patternfly-react';

type ErrorRatePieChartPropType = {
  percentError: number;
  width?: number;
  height?: number;
  showLegend?: boolean;
  legendPos?: string; // e.g. right, left
};

export default class ErrorRatePieChart extends React.Component<ErrorRatePieChartPropType> {
  static defaultProps: ErrorRatePieChartPropType = {
    percentError: 0,
    width: 200,
    height: 80,
    showLegend: true,
    legendPos: 'right'
  };

  constructor(props: ErrorRatePieChartPropType) {
    super(props);
  }

  render() {
    const successRate: number = 100 - this.props.percentError;
    return (
      <PieChart
        className="pie-chart-pf"
        size={{ width: this.props.width, height: this.props.height }}
        data={{
          colors: { '% Success': '#0088ce', '% Fail': '#cc0000' }, // pf-blue, pf-red-100
          columns: [['% Success', successRate], ['% Fail', this.props.percentError]],
          type: 'pie'
        }}
        tooltip={{ contents: () => this.tooltipFn }}
        legend={{ show: this.props.showLegend, position: this.props.legendPos }}
      />
    );
  }

  tooltipFn = () => {
    // TBD
  };
}
