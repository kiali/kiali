import React from 'react';
import { ChartScatter, ChartLine } from '@patternfly/react-charts';
import { storiesOf } from '@storybook/react';

import '@patternfly/react-core/dist/styles/base.css';
import ChartWithLegend from './ChartWithLegend';
import { VCLine, makeLegend, VCLines } from '../types/VictoryChartInfo';
import { buildLine } from '../types/__mocks__/Charts.mock';

const traces: VCLine = buildLine(
  { name: 'span duration', unit: 'seconds', color: 'blue' },
  [0, 4, 5, 8, 16],
  [0.62, 0.80, 0.83, 0.45, 0.152],
  [{ name: 'Trace 1', size: 8 }, { name: 'Trace 2', size: 4 }, { name: 'Trace 3', size: 4 }, { name: 'Trace 4', size: 5 }, { name: 'Trace 5', size: 10 }]
);

const now = new Date().getTime();
const tracesXAsDates = {
  ...traces,
  datapoints: traces.datapoints.map(t => {
    return {
      ...t,
      x: new Date(now + t.x * 1000)
    };
  })
};

const tracesXAsDatesBis = {
  datapoints: tracesXAsDates.datapoints.map(t => {
    return {
      ...t,
      y: t.y * 2,
      color: 'lightblue'
    };
  }),
  legendItem: makeLegend('span duration 2', 'lightblue')
};

const crossing: VCLines = [
  buildLine({ name: 'mm 1', unit: 'ms', color: 'cyan' }, [0, 1, 2], [1, 3, 2]),
  buildLine({ name: 'much longer serie name 2', unit: '', color: 'orange' }, [0, 1, 2], [2, 3, 1])
];

class InChartNav extends React.Component<{}, { from: Date, to: Date, data: VCLine }> {
  constructor(props: {}) {
    super(props);
    this.state = { from: new Date(now - 40000), to: new Date(now + 40000), data: tracesXAsDates };
  }

  render() {
    return (
      <ChartWithLegend
        data={[this.state.data]}
        unit="seconds"
        seriesComponent={(<ChartScatter/>)}
        onClick={dp => alert(`${dp.name}: [${dp.x}, ${dp.y}]`)}
        brushHandlers={{
          onDomainChangeEnd: (_, props) => {
            const domain = props.currentDomain;
            if (domain && domain.x && domain.x[0]) {
              const data = {
                ...this.state.data,
                datapoints: this.state.data.datapoints.filter(d => d.x >= domain.x[0] && d.x <= domain.x[1])
              };
              this.setState({ from: domain.x[0] as Date, to: domain.x[1] as Date, data: data });
            }
          }
        }}
        timeWindow={[this.state.from, this.state.to]}
      />
    );
  }
}

storiesOf('ChartWithLegend', module)
  .add('as scatter plots', () => {
    return (
      <ChartWithLegend
        data={[traces]}
        unit="seconds"
        seriesComponent={(<ChartScatter/>)}
        onClick={dp => alert(`${dp.name}: [${dp.x}, ${dp.y}]`)}
      />
    );
  })
  .add('as scatter with dates and in-chart navigation', () => {
    return <InChartNav/>;
  })
  .add('with two series', () => {
    return <ChartWithLegend data={[tracesXAsDates, tracesXAsDatesBis]} unit="seconds" seriesComponent={(<ChartScatter/>)} onClick={dp => alert(`${dp.name}: [${dp.x}, ${dp.y}]`)} />;
  })
  .add('with crossing point', () => {
    return <ChartWithLegend data={crossing} unit="seconds" stroke={true} seriesComponent={(<ChartLine/>)} />;
  });
