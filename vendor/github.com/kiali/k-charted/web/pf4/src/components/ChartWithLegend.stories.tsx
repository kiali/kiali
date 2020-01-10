import React from 'react';
import { ChartScatter } from '@patternfly/react-charts';
import { storiesOf } from '@storybook/react';

import '@patternfly/react-core/dist/styles/base.css';
import ChartWithLegend from './ChartWithLegend';
import { VCLine, makeLegend } from '../types/VictoryChartInfo';

const traces: VCLine = {
  datapoints: [{
    x: 0,
    y: 0.62,
    name: 'Trace 1',
    unit: 'seconds',
    size: 8
  }, {
    x: 4,
    y: 0.80,
    name: 'Trace 2',
    unit: 'seconds',
    size: 4
  }, {
    x: 5,
    y: 0.83,
    name: 'Trace 3',
    unit: 'seconds',
    size: 4
  }, {
    x: 8,
    y: 0.45,
    name: 'Trace 4',
    unit: 'seconds',
    size: 5
  }, {
    x: 16,
    y: 0.152,
    name: 'Trace 5',
    unit: 'seconds',
    size: 10
  }],
  legendItem: makeLegend('span duration', 'blue')
};

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
      y: t.y * 2
    };
  }),
  legendItem: makeLegend('span duration', 'lightblue')
};

storiesOf('ChartWithLegend', module)
  .add('as scatter plots', () => {
    return <ChartWithLegend data={[traces]} unit="seconds" seriesComponent={(<ChartScatter/>)} onClick={dp => alert(`${dp.name}: [${dp.x}, ${dp.y}]`)} />;
  })
  .add('as scatter plots with dates', () => {
    return (
      <ChartWithLegend
        data={[tracesXAsDates]}
        unit="seconds"
        seriesComponent={(<ChartScatter/>)}
        onClick={dp => alert(`${dp.name}: [${dp.x}, ${dp.y}]`)}
        timeWindow={[new Date(now - 40000), new Date(now + 40000)]}
      />
    );
  })
  .add('with two series', () => {
    return <ChartWithLegend data={[tracesXAsDates, tracesXAsDatesBis]} unit="seconds" seriesComponent={(<ChartScatter/>)} onClick={dp => alert(`${dp.name}: [${dp.x}, ${dp.y}]`)} />;
  });
