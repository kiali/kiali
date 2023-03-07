import * as React from 'react';
import { shallowToJson } from 'enzyme-to-json';
import { shallow } from 'enzyme';
import ValidationSummary from '../ValidationSummary';

const testScenario = (summary: any) => {
  const wrapper = shallow(summary);
  expect(shallowToJson(wrapper)).toBeDefined();
  expect(shallowToJson(wrapper)).toMatchSnapshot();
};

describe('ValidationSummary renders', () => {
  it('success icon when all components are valid', () => {
    testScenario(<ValidationSummary id={'1'} errors={0} warnings={0} objectCount={1} />);
    testScenario(<ValidationSummary id={'1'} errors={0} warnings={0} objectCount={4} />);
  });

  it('warning icon when all components are valid', () => {
    testScenario(<ValidationSummary id={'2'} errors={0} warnings={1} objectCount={1} />);
    testScenario(<ValidationSummary id={'2'} errors={0} warnings={1} objectCount={3} />);
  });

  it('error icon when all components are valid', () => {
    testScenario(<ValidationSummary id={'3'} errors={1} warnings={0} objectCount={1} />);
    testScenario(<ValidationSummary id={'3'} errors={1} warnings={2} objectCount={3} />);
  });

  it('N/A when all components are valid', () => {
    testScenario(<ValidationSummary id={'4'} errors={0} warnings={0} objectCount={0} />);
  });
});
