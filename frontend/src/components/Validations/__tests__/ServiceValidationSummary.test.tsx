import * as React from 'react';
import { shallowToJson } from 'enzyme-to-json';
import { shallow } from 'enzyme';
import ServiceValidationSummary from '../ServiceValidationSummary';

const testScenario = (summary: any) => {
  const wrapper = shallow(summary);
  expect(shallowToJson(wrapper)).toBeDefined();
  expect(shallowToJson(wrapper)).toMatchSnapshot();
};

describe('ServiceValidationSummary renders', () => {
  it('success icon when all components are valid', () => {
    testScenario(<ServiceValidationSummary id={'1'} errors={0} warnings={0} />);
  });

  it('warning icon when all components are valid', () => {
    testScenario(<ServiceValidationSummary id={'2'} errors={0} warnings={1} />);
    testScenario(<ServiceValidationSummary id={'2'} errors={0} warnings={2} />);
  });

  it('error icon when all components are valid', () => {
    testScenario(<ServiceValidationSummary id={'3'} errors={1} warnings={0} />);
    testScenario(<ServiceValidationSummary id={'3'} errors={1} warnings={2} />);
  });
});
