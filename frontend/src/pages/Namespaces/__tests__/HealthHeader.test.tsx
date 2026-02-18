import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { HealthHeader } from '../HealthHeader';

jest.mock('utils/I18nUtils', () => ({
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('HealthHeader', () => {
  describe('Component rendering', () => {
    it('renders without crashing', () => {
      const wrapper = shallow(<HealthHeader />);
      expect(wrapper.exists()).toBeTruthy();
    });

    it('renders "Health" text', () => {
      const wrapper = mount(<HealthHeader />);
      expect(wrapper.text()).toContain('Health');
    });

    it('renders Popover help', () => {
      const wrapper = mount(<HealthHeader />);
      const popover = wrapper.find('Popover');
      expect(popover.exists()).toBeTruthy();
      expect(popover.prop('aria-label')).toBe('Namespace health information');
    });
  });

  describe('Popover content', () => {
    it('contains namespace health heading', () => {
      const wrapper = mount(<HealthHeader />);
      const popover = wrapper.find('Popover');
      const headerContent = popover.prop('headerContent');

      expect(headerContent).toBeDefined();
      if (React.isValidElement(headerContent)) {
        const headerWrapper = shallow(headerContent);
        expect(headerWrapper.text()).toContain('Namespace Health');
      }
    });

    it('contains aggregate state description', () => {
      const wrapper = mount(<HealthHeader />);
      const popover = wrapper.find('Popover');
      const bodyContent = popover.prop('bodyContent');

      if (React.isValidElement(bodyContent)) {
        const contentWrapper = shallow(bodyContent);
        expect(contentWrapper.text()).toContain(
          'The aggregate state of all apps, services and workloads within the namespace.'
        );
      }
    });

    it('contains Healthy status description', () => {
      const wrapper = mount(<HealthHeader />);
      const popover = wrapper.find('Popover');
      const bodyContent = popover.prop('bodyContent');

      if (React.isValidElement(bodyContent)) {
        const contentWrapper = shallow(bodyContent);
        expect(contentWrapper.text()).toContain('Healthy');
        expect(contentWrapper.text()).toContain('All components are healthy');
      }
    });

    it('contains Unhealthy status description', () => {
      const wrapper = mount(<HealthHeader />);
      const popover = wrapper.find('Popover');
      const bodyContent = popover.prop('bodyContent');

      if (React.isValidElement(bodyContent)) {
        const contentWrapper = shallow(bodyContent);
        expect(contentWrapper.text()).toContain('Unhealthy');
        expect(contentWrapper.text()).toContain('One or more components are unhealthy');
      }
    });

    it('contains n/a status description', () => {
      const wrapper = mount(<HealthHeader />);
      const popover = wrapper.find('Popover');
      const bodyContent = popover.prop('bodyContent');

      if (React.isValidElement(bodyContent)) {
        const contentWrapper = shallow(bodyContent);
        expect(contentWrapper.text()).toContain('n/a');
        expect(contentWrapper.text()).toContain('No components available to monitor');
      }
    });
  });

  describe('Popover properties', () => {
    it('has aria-label for accessibility', () => {
      const wrapper = mount(<HealthHeader />);
      const popover = wrapper.find('Popover');
      expect(popover.prop('aria-label')).toBe('Namespace health information');
    });
  });
});
