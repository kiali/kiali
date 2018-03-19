import * as React from 'react';

import { PieChart } from 'patternfly-react';

type ErrorRatePieChartPropType = {
  percentError: number;
};

export class ErrorRatePieChart extends React.Component<ErrorRatePieChartPropType, {}> {
  render() {
    const successRate: number = 100 - this.props.percentError;
    return (
      <PieChart
        className="pie-chart-pf"
        size={{ width: 200, height: 80 }}
        data={{
          colors: { '% Success': '#0088ce', '% Fail': '#c00' },
          columns: [['% Success', successRate], ['% Fail', this.props.percentError]],
          type: 'pie'
        }}
        tooltip={{ contents: () => this.tooltipFn }}
        legend={{ show: true, position: 'right' }}
      />
    );
  }

  tooltipFn = () => {
    // TBD
  };
}
