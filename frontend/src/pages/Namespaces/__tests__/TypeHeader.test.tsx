import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { TypeHeader } from '../TypeHeader';

jest.mock('utils/I18nUtils', () => ({
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('TypeHeader', () => {
  describe('Component rendering', () => {
    it('renders without crashing', () => {
      const wrapper = shallow(<TypeHeader />);
      expect(wrapper.exists()).toBeTruthy();
    });

    it('renders "Type" text', () => {
      const wrapper = mount(<TypeHeader />);
      expect(wrapper.text()).toContain('Type');
    });

    it('renders clickable info icon', () => {
      const wrapper = mount(<TypeHeader />);
      // The icon is rendered inside the Tooltip component
      expect(wrapper.find('Tooltip').exists()).toBeTruthy();
      // Check that there's a span with inline styles for the icon
      const spans = wrapper.find('span');
      expect(spans.length).toBeGreaterThan(0);
    });

    it('renders tooltip', () => {
      const wrapper = mount(<TypeHeader />);
      expect(wrapper.find('Tooltip').exists()).toBeTruthy();
    });
  });

  describe('Tooltip content', () => {
    it('contains namespace type heading', () => {
      const wrapper = mount(<TypeHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      expect(content).toBeDefined();
      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain('Namespace type');
      }
    });

    it('contains CP (Control plane) description', () => {
      const wrapper = mount(<TypeHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain('CP');
        expect(contentWrapper.text()).toContain('Control plane');
        expect(contentWrapper.text()).toContain('Istio control plane');
      }
    });

    it('contains DP (Data plane) description', () => {
      const wrapper = mount(<TypeHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain('DP');
        expect(contentWrapper.text()).toContain('Data plane');
        expect(contentWrapper.text()).toContain('Namespace is part of the mesh');
      }
    });

    it('contains Empty description', () => {
      const wrapper = mount(<TypeHeader />);
      const tooltip = wrapper.find('Tooltip');
      const content = tooltip.prop('content');

      if (React.isValidElement(content)) {
        const contentWrapper = shallow(content);
        expect(contentWrapper.text()).toContain('Empty');
        expect(contentWrapper.text()).toContain('Namespace is not part of the mesh');
      }
    });
  });

  describe('Tooltip positioning', () => {
    it('uses top position for tooltip', () => {
      const wrapper = mount(<TypeHeader />);
      const tooltip = wrapper.find('Tooltip');
      expect(tooltip.prop('position')).toBe('top');
    });
  });

  describe('Icon styling', () => {
    it('applies correct styles to info icon', () => {
      const wrapper = mount(<TypeHeader />);
      const iconSpan = wrapper.find('span').at(1);
      const styles = iconSpan.prop('className');
      expect(styles).toBeDefined();
    });
  });
});
