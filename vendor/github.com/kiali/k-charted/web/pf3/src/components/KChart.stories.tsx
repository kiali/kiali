import React from 'react';
import { storiesOf } from '@storybook/react';
import KChart from './KChart';
import { getDataSupplier } from '../utils/c3ChartsUtils';
import { empty, error, generateRandomMetricChart, generateRandomHistogramChart, emptyLabels } from '../types/__mocks__/Charts.mock';

import 'patternfly/dist/css/patternfly.css';
import 'patternfly/dist/css/patternfly-additions.css';
import 'patternfly-react/dist/css/patternfly-react.css';

const metric = generateRandomMetricChart('Random metric chart', ['dogs', 'cats', 'birds'], 'kchart-seed');
const histogram = generateRandomHistogramChart('Random histogram chart', 'kchart-histo-seed');

storiesOf('PF3 KChart', module)
.add('with data', () => (
  <KChart chart={metric} dataSupplier={getDataSupplier(metric, emptyLabels)!} />
))
.add('histogram', () => (
  <KChart chart={histogram} dataSupplier={getDataSupplier(histogram, emptyLabels)!} />
))
  .add('empty', () => (
    <KChart chart={empty} dataSupplier={getDataSupplier(empty, emptyLabels)!} />
  ))
  .add('with error', () => (
    <KChart chart={error} dataSupplier={getDataSupplier(empty, emptyLabels)!} />
  ));
