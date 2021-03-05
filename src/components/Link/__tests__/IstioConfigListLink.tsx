import * as React from 'react';
import IstioConfigListLink from '../IstioConfigListLink';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

const mockLink = (namespaces: string[], errors?: boolean, warnings?: boolean) => {
  return shallow(<IstioConfigListLink namespaces={namespaces} warnings={warnings} errors={errors} />);
};

describe('Link with only namespaces', () => {
  describe('but only one namespace', () => {
    it('renders the link with only one namespace', () => {
      const wrapper = mockLink(['bookinfo']);

      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();

      expect(wrapper.find('Link').props().to).toEqual('/istio?namespaces=bookinfo');
    });
  });

  describe('and more than one', () => {
    it('renders the link with only one namespace', () => {
      const wrapper = mockLink(['bookinfo', 'istio-system', 'runtimes']);

      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();

      expect(wrapper.find('Link').props().to).toEqual('/istio?namespaces=bookinfo,istio-system,runtimes');
    });
  });
});

describe('Link with validation filters', () => {
  describe('and only warnings', () => {
    it('renders link with namespaces and only warning filters', () => {
      const wrapper = mockLink(['bookinfo'], false, true);

      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();

      expect(wrapper.find('Link').props().to).toEqual('/istio?namespaces=bookinfo&configvalidation=Warning');
    });
  });

  describe('and only errors', () => {
    it('renders link with namespaces and only errors filters', () => {
      const wrapper = mockLink(['bookinfo', 'runtimes'], true, false);

      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();

      expect(wrapper.find('Link').props().to).toEqual('/istio?namespaces=bookinfo,runtimes&configvalidation=Not+Valid');
    });
  });

  describe('and both errors and warnings', () => {
    it('renders link with namespaces and only errors filters', () => {
      const wrapper = mockLink(['bookinfo', 'runtimes'], true, true);

      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();

      expect(wrapper.find('Link').props().to).toEqual(
        '/istio?namespaces=bookinfo,runtimes&configvalidation=Warning&configvalidation=Not+Valid'
      );
    });
  });
});
