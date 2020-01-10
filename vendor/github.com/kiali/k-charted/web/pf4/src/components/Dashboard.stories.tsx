import React from 'react';
import { storiesOf } from '@storybook/react';
import { getTheme, ChartThemeColor, ChartThemeVariant } from '@patternfly/react-charts';
import { Dashboard } from './Dashboard';
import { emptyDashboard, generateRandomDashboard } from '../types/__mocks__/Dashboards.mock';
import { biggerTimeWindow } from '../types/__mocks__/Charts.mock';

import '@patternfly/react-core/dist/styles/base.css';

const labels = new Map([['color', { 'green': true, 'orange': true, 'yellow': true }]]);

storiesOf('PF4 Dashboard', module)
  .add('with data', () => (
    <Dashboard
      dashboard={generateRandomDashboard('Dashboard with data', 'dashboard-seed')}
      labelValues={labels}
      expandHandler={() => {}}
      onClick={(chart, dp) => alert(`${chart.name} - ${dp.name}: [${dp.x}, ${dp.y}]`)}
    />
  ))
  .add('with gold theme and time window', () => {
    const colors = getTheme(ChartThemeColor.gold, ChartThemeVariant.dark).chart.colorScale;
    return (
      <Dashboard
        dashboard={generateRandomDashboard('Dashboard with data', 'dashboard-seed')}
        labelValues={labels}
        expandHandler={() => {}} colors={colors}
        timeWindow={biggerTimeWindow}
      />
    );
  })
  .add('empty', () => (
    <Dashboard dashboard={emptyDashboard} labelValues={new Map()} expandHandler={() => {}} />
  ))
;
