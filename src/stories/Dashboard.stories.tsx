import React from 'react';
import { Story, Meta } from '@storybook/react';

import { Dashboard, Props } from '../components/Charts/Dashboard';
import { LineInfo } from '../types/VictoryChartInfo';
import { TOP_PADDING } from '../components/Nav/Page/RenderComponentScroll';

//Data

import { dashboardService, dashboardEnvoy, dashboardServiceSpans, dashboardWithlegends } from './__dataStories__';
import * as MetricsHelper from '../components/Metrics/Helper';

export default {
  title: 'Kiali/Dashboard',
  component: Dashboard,
  argTypes: {
    backgroundColor: { control: 'color' }
  }
} as Meta;

const settings = MetricsHelper.retrieveMetricsSettings();
var labelSettings = settings.labelsSettings;

const Template: Story<Props<LineInfo>> = args => <Dashboard {...args} />;

export const Metrics = Template.bind({});
Metrics.args = {
  dashboard: dashboardService,
  labelValues: MetricsHelper.convertAsPromLabels(MetricsHelper.extractLabelsSettings(dashboardService, labelSettings)),
  expandHandler: () => {},
  showSpans: false,
  chartHeight: window.innerHeight - TOP_PADDING
};

export const WithAllLegends = Template.bind({});
WithAllLegends.args = {
  dashboard: dashboardWithlegends,
  labelValues: MetricsHelper.convertAsPromLabels(
    MetricsHelper.extractLabelsSettings(dashboardWithlegends, labelSettings)
  ),
  expandHandler: () => {},
  showSpans: false,
  chartHeight: window.innerHeight - TOP_PADDING
};

export const withSpans = Template.bind({});
withSpans.args = {
  dashboard: dashboardService,
  labelValues: MetricsHelper.convertAsPromLabels(MetricsHelper.extractLabelsSettings(dashboardService, labelSettings)),
  expandHandler: () => {},
  showSpans: true,
  overlay: dashboardServiceSpans,
  chartHeight: window.innerHeight - TOP_PADDING
};

export const EnvoyMetrics = Template.bind({});
EnvoyMetrics.args = {
  dashboard: dashboardEnvoy,
  labelValues: MetricsHelper.convertAsPromLabels(MetricsHelper.extractLabelsSettings(dashboardEnvoy, labelSettings)),
  expandHandler: () => {},
  showSpans: false,
  template: 'envoy',
  customMetric: true,
  chartHeight: window.innerHeight - TOP_PADDING
};
