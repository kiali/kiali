import * as React from 'react';
import { render } from '@testing-library/react';
import { ValidationSummary } from '../ValidationSummary';

const testScenario = (summary: any): void => {
  const { container } = render(summary);
  expect(container).toMatchSnapshot();
};

describe('ValidationSummary renders', () => {
  it('success icon when all istio components are valid', () => {
    testScenario(<ValidationSummary id={'1'} errors={0} warnings={0} objectCount={1} type="istio" />);
    testScenario(<ValidationSummary id={'1'} errors={0} warnings={0} objectCount={4} type="istio" />);
  });

  it('warning icon when all istio components are valid', () => {
    testScenario(<ValidationSummary id={'2'} errors={0} warnings={1} objectCount={1} type="istio" />);
    testScenario(<ValidationSummary id={'2'} errors={0} warnings={1} objectCount={3} type="istio" />);
  });

  it('error icon when all istio components are valid', () => {
    testScenario(<ValidationSummary id={'3'} errors={1} warnings={0} objectCount={1} type="istio" />);
    testScenario(<ValidationSummary id={'3'} errors={1} warnings={2} objectCount={3} type="istio" />);
  });

  it('n/a when all istio components are valid', () => {
    testScenario(<ValidationSummary id={'4'} errors={0} warnings={0} objectCount={0} type="istio" />);
  });

  it('success icon when all services are valid', () => {
    testScenario(<ValidationSummary id={'1'} errors={0} warnings={0} type="service" />);
  });

  it('warning icon when all services are valid', () => {
    testScenario(<ValidationSummary id={'2'} errors={0} warnings={1} type="service" />);
    testScenario(<ValidationSummary id={'2'} errors={0} warnings={2} type="service" />);
  });

  it('error icon when all services are valid', () => {
    testScenario(<ValidationSummary id={'3'} errors={1} warnings={0} type="service" />);
    testScenario(<ValidationSummary id={'3'} errors={1} warnings={2} type="service" />);
  });
});
