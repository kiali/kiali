import * as React from 'react';
import { shallow } from 'enzyme';
import ValidationSummaryLink from '../ValidationSummaryLink';
import { shallowToJson } from 'enzyme-to-json';

const mockLink = (namespace: string, errors: number, warnings: number, objectCount?: number) => {
  return shallow(
    <ValidationSummaryLink namespace={namespace} errors={errors} warnings={warnings} objectCount={objectCount}>
      Summary Link
    </ValidationSummaryLink>
  );
};

describe('ValidationSummaryLink', () => {
  describe('when there are no objects', () => {
    it('is a N/A non-linked component', () => {
      const wrapper = mockLink('bookinfo', 0, 0, 0);

      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();

      expect(wrapper.html()).toContain('N/A');
    });
  });

  describe('when there are objects', () => {
    describe('and only has errors', () => {
      it('points to IstioConfig list with errors filter', () => {
        const wrapper = mockLink('bookinfo', 2, 0, 2);

        expect(shallowToJson(wrapper)).toBeDefined();
        expect(shallowToJson(wrapper)).toMatchSnapshot();

        const linkComponent = wrapper.find('IstioConfigListLink');
        expect(linkComponent).toBeDefined();

        const linkProps = linkComponent.props();
        expect(linkProps.children).toContain('Summary Link');
        expect(linkProps['errors']).toBeTruthy();
        expect(linkProps['warnings']).toBeFalsy();
        expect(linkProps['namespaces']).toEqual(['bookinfo']);
      });
    });

    describe('and only has warnings', () => {
      it('points to IstioConfig list with warnings filter', () => {
        const wrapper = mockLink('bookinfo', 0, 3, 2);

        expect(shallowToJson(wrapper)).toBeDefined();
        expect(shallowToJson(wrapper)).toMatchSnapshot();

        const linkComponent = wrapper.find('IstioConfigListLink');
        expect(linkComponent).toBeDefined();

        const linkProps = linkComponent.props();
        expect(linkProps.children).toContain('Summary Link');
        expect(linkProps['errors']).toBeFalsy();
        expect(linkProps['warnings']).toBeTruthy();
        expect(linkProps['namespaces']).toEqual(['bookinfo']);
      });
    });

    describe('and has both errors and warnings', () => {
      it('points to IstioConfig list with both warnings and errors filter', () => {
        const wrapper = mockLink('bookinfo', 2, 3, 2);

        expect(shallowToJson(wrapper)).toBeDefined();
        expect(shallowToJson(wrapper)).toMatchSnapshot();

        const linkComponent = wrapper.find('IstioConfigListLink');
        expect(linkComponent).toBeDefined();

        const linkProps = linkComponent.props();
        expect(linkProps.children).toContain('Summary Link');
        expect(linkProps['errors']).toBeTruthy();
        expect(linkProps['warnings']).toBeTruthy();
        expect(linkProps['namespaces']).toEqual(['bookinfo']);
      });
    });
  });
});
