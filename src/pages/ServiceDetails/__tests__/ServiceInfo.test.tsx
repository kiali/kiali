import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfo from '../ServiceInfo';

jest.mock('../../../services/Api');

describe('#ServiceInfo render correctly with data', () => {
  it('should render serviceInfo', () => {
    const wrapper = shallow(<ServiceInfo namespace="istio-system" service="reviews" />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('ServiceInfoDescription').length === 1).toBeTruthy();
    expect(wrapper.find('ServiceInfoPods').length === 1).toBeTruthy();
    expect(wrapper.find('ServiceInfoRoutes').length === 1).toBeTruthy();
    expect(wrapper.find('ServiceInfoRules').length === 1).toBeTruthy();
  });
});
