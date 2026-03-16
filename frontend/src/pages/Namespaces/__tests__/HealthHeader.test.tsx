import * as React from 'react';
import { shallow } from 'enzyme';
import { HealthPopoverBody, HealthPopoverHeader } from '../HealthHeader';

jest.mock('utils/I18nUtils', () => ({
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('HealthPopoverHeader', () => {
  it('renders namespace health heading', () => {
    const wrapper = shallow(<HealthPopoverHeader />);
    expect(wrapper.text()).toContain('Namespace Health');
  });
});

describe('HealthPopoverBody', () => {
  it('renders without crashing', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.exists()).toBeTruthy();
  });

  it('contains aggregate state description', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain(
      'Health represents the aggregated status of all apps, services, and workloads within the namespace.'
    );
    expect(wrapper.text()).toContain("A namespace's status is determined by its lowest-performing component.");
  });

  it('contains Healthy status description', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain('Healthy');
    expect(wrapper.text()).toContain('All components operating normally and meeting all performance targets');
  });

  it('contains Unhealthy status with sub-statuses', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain('Unhealthy');
    expect(wrapper.text()).toContain('One or more components are not working as expected');
    expect(wrapper.text()).toContain('Failure');
    expect(wrapper.text()).toContain('critical state and failing to meet basic requirements');
    expect(wrapper.text()).toContain('Degraded');
    expect(wrapper.text()).toContain('functional but performing below optimal thresholds');
    expect(wrapper.text()).toContain('Not ready');
    expect(wrapper.text()).toContain('exists but cannot serve traffic yet');
  });

  it('contains n/a status description', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain('n/a');
    expect(wrapper.text()).toContain('No components available to monitor');
  });
});
