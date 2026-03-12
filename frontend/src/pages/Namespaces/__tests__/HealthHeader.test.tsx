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
  });

  it('contains Healthy status description', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain('Healthy');
    expect(wrapper.text()).toContain('All components are healthy');
  });

  it('contains Degraded status description', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain('Degraded');
    expect(wrapper.text()).toContain('One or more components have warnings');
  });

  it('contains Failure status description', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain('Failure');
    expect(wrapper.text()).toContain('One or more components have errors');
  });

  it('contains Not Ready status description', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain('Not Ready');
    expect(wrapper.text()).toContain('One or more components are not ready');
  });

  it('contains n/a status description', () => {
    const wrapper = shallow(<HealthPopoverBody />);
    expect(wrapper.text()).toContain('n/a');
    expect(wrapper.text()).toContain('No components available to monitor');
  });
});
