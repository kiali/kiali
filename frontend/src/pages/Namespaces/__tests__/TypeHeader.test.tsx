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

    it('renders Popover help', () => {
      const wrapper = mount(<TypeHeader />);
      const popover = wrapper.find('Popover');
      expect(popover.exists()).toBeTruthy();
      expect(popover.prop('aria-label')).toBe('Namespace type information');
    });
  });

  describe('Popover content', () => {
    it('contains namespace type heading', () => {
      const wrapper = mount(<TypeHeader />);
      const popover = wrapper.find('Popover');
      const headerContent = popover.prop('headerContent');

      expect(headerContent).toBeDefined();
      if (React.isValidElement(headerContent)) {
        const headerWrapper = shallow(headerContent);
        expect(headerWrapper.text()).toContain('Namespace type');
      }
    });

    it('contains CP (Control plane) description', () => {
      const wrapper = mount(<TypeHeader />);
      const popover = wrapper.find('Popover');
      const bodyContent = popover.prop('bodyContent');

      if (React.isValidElement(bodyContent)) {
        const contentWrapper = shallow(bodyContent);
        expect(contentWrapper.text()).toContain('CP');
        expect(contentWrapper.text()).toContain('Control plane');
        expect(contentWrapper.text()).toContain('Istio control plane');
      }
    });

    it('contains DP (Data plane) description', () => {
      const wrapper = mount(<TypeHeader />);
      const popover = wrapper.find('Popover');
      const bodyContent = popover.prop('bodyContent');

      if (React.isValidElement(bodyContent)) {
        const contentWrapper = shallow(bodyContent);
        expect(contentWrapper.text()).toContain('DP');
        expect(contentWrapper.text()).toContain('Data plane');
        expect(contentWrapper.text()).toContain('Namespace is part of the mesh');
      }
    });

    it('contains Empty description', () => {
      const wrapper = mount(<TypeHeader />);
      const popover = wrapper.find('Popover');
      const bodyContent = popover.prop('bodyContent');

      if (React.isValidElement(bodyContent)) {
        const contentWrapper = shallow(bodyContent);
        expect(contentWrapper.text()).toContain('Empty');
        expect(contentWrapper.text()).toContain('Namespace is not part of the mesh');
      }
    });
  });
});
