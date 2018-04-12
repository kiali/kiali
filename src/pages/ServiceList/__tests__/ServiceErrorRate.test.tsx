import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceErrorRate from '../ServiceErrorRate';
import { ServiceItem } from '../../../types/ServiceListComponent';

describe('ServiceErrorRate', () => {
  it('should render correctly with basic data', () => {
    const service = {
      request_count: 10,
      error_rate: 0
    } as ServiceItem;

    const wrapper = shallow(<ServiceErrorRate service={service} />);
    expect(wrapper.text()).toBe('Error rate: 0.00%<Icon />');
  });

  it('should render OK icon when error rate is good', () => {
    const service = {
      request_count: 10,
      error_rate: 0
    } as ServiceItem;

    const wrapper = shallow(<ServiceErrorRate service={service} />);
    expect(wrapper.find('Icon').prop('name')).toBe('ok');
  });

  it('should render WARNING icon when error rate is acceptable', () => {
    const service = {
      request_count: 10,
      error_rate: 0.15
    } as ServiceItem;

    const wrapper = shallow(<ServiceErrorRate service={service} />);
    expect(wrapper.find('Icon').prop('name')).toBe('warning-triangle-o');
  });

  it('should render ERROR icon when error rate is acceptable', () => {
    const service = {
      request_count: 10,
      error_rate: 0.2 + Number.EPSILON
    } as ServiceItem;

    const wrapper = shallow(<ServiceErrorRate service={service} />);
    expect(wrapper.find('Icon').prop('name')).toBe('error-circle-o');
  });

  it('should inform that the service has received no requests', () => {
    const service = {
      request_count: 0,
      error_rate: 0
    } as ServiceItem;

    const wrapper = shallow(<ServiceErrorRate service={service} />);
    expect(wrapper.text()).toMatch(/No requests/);
  });
});
