import React from 'react';
import { storiesOf } from '@storybook/react';

import { genDates, buildLine } from '../types/__mocks__/Charts.mock';
import { SparklineChart } from './SparklineChart';
import { VCLines } from '../types/VictoryChartInfo';

import '@patternfly/react-core/dist/styles/base.css';

const dates = genDates(5);

const histo: VCLines = [
  buildLine({ name: 'p99', unit: 'ms', color: 'orange' }, dates, [2, 3, 2, 5, 3]),
  buildLine({ name: 'p95', unit: 'ms', color: 'blue' }, dates, [2, 2.6666, 2, 3, 2]),
  buildLine({ name: 'p50', unit: 'ms', color: 'green' }, dates, [2, 2.5, 2, 2.5, 2]),
  buildLine({ name: 'avg', unit: 'ms', color: 'black' }, dates, [1.599, 1.8444, 2, 3, 1.5])
];

const rps: VCLines = [
  buildLine({ name: 'RPS', unit: 'rps', color: 'blue' }, dates, [2, 3, 2, 5, 3]),
  buildLine({ name: 'Error', unit: 'rps', color: 'red' }, dates, [0, 0.6666, 0.1111, 0.9111, 0])
];

storiesOf('SparklineCharts', module)
  .add('histogram', () => {
    return (
      <div style={{ width: 300 }}>
        <SparklineChart
          name={'rt'}
          height={70}
          width={300}
          showLegend={true}
          padding={{ top: 5 }}
          tooltipFormat={dp => {
            const val = Math.floor(dp.y * 1000) / 1000;
            return `${(dp.x as Date).toLocaleTimeString()} - ${dp.name}: ${val} ms`;
          }}
          series={histo}
        />
      </div>
    );
  })
  .add('RPS', () => {
    return (
      <div style={{ width: 300 }}>
        <SparklineChart
          name={'rps'}
          height={41}
          width={300}
          showLegend={false}
          padding={{ top: 5 }}
          tooltipFormat={dp => `${(dp.x as Date).toLocaleTimeString()}\n${dp.y} RPS`}
          series={rps}
        />
      </div>
    );
  });
