import React from 'react';
import { storiesOf } from '@storybook/react';
import KChart from './KChart';
import { getDataSupplier, toOverlay, toVCLine, toVCDatapoints } from '../utils/victoryChartsUtils';
import { empty, error, generateRandomMetricChart, generateRandomHistogramChart, generateRandomForOverlay, emptyLabels } from '../types/__mocks__/Charts.mock';

import '@patternfly/react-core/dist/styles/base.css';
import { OverlayInfo } from '../types/Overlay';

const metric = generateRandomMetricChart('Random metric chart', ['dogs', 'cats', 'birds'], 12, 'kchart-seed');
const histogram = generateRandomHistogramChart('Random histogram chart', 12, 'kchart-histo-seed');
const colors = ['red', 'green', 'blue'];

const reset = () => {
  metric.chartType = undefined;
  metric.min = undefined;
  metric.max = undefined;
};

storiesOf('PF4 KChart', module)
  .add('as lines', () => {
    reset();
    return <KChart chart={metric} data={getDataSupplier(metric, emptyLabels, colors)!()} />;
  })
  .add('as areas', () => {
    reset();
    metric.chartType = 'area';
    return <KChart chart={metric} data={getDataSupplier(metric, emptyLabels, colors)!()} />;
  })
  .add('as bars', () => {
    reset();
    metric.chartType = 'bar';
    return <KChart chart={metric} data={getDataSupplier(metric, emptyLabels, colors)!()} />;
  })
  .add('with min=20, max=100', () => {
    reset();
    metric.min = 20;
    metric.max = 100;
    return <KChart chart={metric} data={getDataSupplier(metric, emptyLabels, colors)!()} />;
  })
  .add('with overlay', () => {
    reset();
    const info: OverlayInfo = {
      title: 'Span duration',
      unit: 'seconds',
      dataStyle: { fill: 'pink' },
      color: 'pink',
      symbol: 'star',
      size: 15
    };
    const dps = toVCDatapoints(generateRandomForOverlay(), info.title);
    return (
      <KChart chart={metric} data={getDataSupplier(metric, emptyLabels, colors)!()} overlay={toOverlay(info, dps)} />
    );
  })
  .add('histogram', () => (
    <KChart chart={histogram} data={getDataSupplier(histogram, emptyLabels, colors)!()} />
  ))
  .add('empty', () => (
    <KChart chart={empty} data={getDataSupplier(empty, emptyLabels, colors)!()} />
  ))
  .add('with error', () => (
    <KChart chart={error} data={getDataSupplier(empty, emptyLabels, colors)!()} />
  ));
