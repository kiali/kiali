import '../../app/App.css';

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import MetricsOptionsBar from './MetricsOptionsBar';

const stories = storiesOf('MetricsOptions', module);

stories.add('MetricsOptionsBar', () => (
  <MetricsOptionsBar
    onPollIntervalChanged={action('onPollIntervalChanged')}
    onOptionsChanged={action('onOptionsChanged')}
  />
));
