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

    it('renders help icon', () => {
      const wrapper = mount(<HealthHeader />);
      expect(wrapper.find('HelpIcon').exists()).toBeTruthy();
    });

    it('renders tooltip', () => {
      const wrapper = mount(<HealthHeader />);
      expect(wrapper.find('Tooltip').exists()).toBeTruthy();
    });

    it('renders with flex layout', () => {
      const wrapper = mount(<HealthHeader />);
      const mainDiv = wrapper.find('div').first();
      const style = mainDiv.prop('style');
      expect(style).toMatchObject({ display: 'flex', alignItems: 'center' });
    });
  });

  describe('Tooltip content', () => {
    it('contains namespace health heading', () => {
      const wrapper = mount(<HealthHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      expect(content).toBeDefined();
      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain('Namespace Health');
      }
    });

    it('contains aggregate state description', () => {
      const wrapper = mount(<HealthHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain(
          'The aggregate state of all apps, services and workloads within the namespace.'
        );
      }
    });

    it('contains Healthy status description', () => {
      const wrapper = mount(<HealthHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain('Healthy');
        expect(contentWrapper.text()).toContain('All components are healthy');
      }
    });

    it('contains Unhealthy status description', () => {
      const wrapper = mount(<HealthHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain('Unhealthy');
        expect(contentWrapper.text()).toContain('One or more components are unhealthy');
      }
    });

    it('contains n/a status description', () => {
      const wrapper = mount(<HealthHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain('n/a');
        expect(contentWrapper.text()).toContain('No health information');
      }
    });
  });

  describe('Tooltip properties', () => {
    it('uses auto position for tooltip', () => {
      const wrapper = mount(<HealthHeader />);
      const tooltip = wrapper.find('Tooltip');
      expect(tooltip.prop('position')).toBe('auto');
    });

    it('has aria-label for accessibility', () => {
      const wrapper = mount(<HealthHeader />);
      const tooltip = wrapper.find('Tooltip');
      expect(tooltip.prop('aria-label')).toBe('Namespace health information');
    });
  });

  describe('Icon styling', () => {
    it('applies correct styles to help icon', () => {
      const wrapper = mount(<HealthHeader />);
      const helpIcon = wrapper.find('HelpIcon');
      const style = helpIcon.prop('style');
      expect(style).toMatchObject({ cursor: 'pointer', color: '#6a6e73' });
    });
  });

  describe('Layout structure', () => {
    it('has proper gap between text and icon', () => {
      const wrapper = mount(<HealthHeader />);
      const mainDiv = wrapper.find('div').first();
      const style = mainDiv.prop('style');
      expect(style).toHaveProperty('gap', '0.5rem');
    });

    it('contains span with Health text', () => {
      const wrapper = mount(<HealthHeader />);
      const span = wrapper.find('span');
      expect(span.exists()).toBeTruthy();
      expect(span.text()).toBe('Health');
    });
  });
});
