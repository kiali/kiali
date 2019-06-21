import React from 'react';
import { storiesOf } from '@storybook/react';
import { Dashboard } from './Dashboard';
import { emptyDashboard, generateRandomDashboard } from '../../types/__mocks__/Dashboards.mock';

import '@patternfly/react-core/dist/styles/base.css';

storiesOf('PF3 Dashboard', module)
  .add('empty', () => (
    <Dashboard dashboard={emptyDashboard} labelValues={new Map()} expandHandler={() => {}} />
  ))
  .add('with data', () => (
    <Dashboard dashboard={generateRandomDashboard('Dashboard with data', 'dashboard-seed')} labelValues={new Map()} expandHandler={() => {}} />
  ))
;
