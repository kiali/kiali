import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import * as ActualAPI from '../../../services/Api';
import ServiceInfo from '../ServiceInfo';

jest.mock('../../../services/Api');

const API = require('../../../services/Api') as typeof ActualAPI;

describe('#ServiceInfo render correctly with data', () => {
  it('should render serviceInfo with data', () => {
    return API.getServiceDetail('istio-system', 'reviews', true).then(data => {
      const wrapper = shallow(
        <ServiceInfo
          namespace="istio-system"
          service="reviews"
          serviceDetails={data}
          gateways={[]}
          validations={data.validations}
          onRefresh={jest.fn()}
          onSelectTab={jest.fn()}
          activeTab={jest.fn()}
          threeScaleInfo={{
            enabled: false,
            permissions: {
              create: false,
              update: false,
              delete: false
            }
          }}
        />
      );
      expect(shallowToJson(wrapper)).toBeDefined();
      expect(shallowToJson(wrapper)).toMatchSnapshot();
      expect(wrapper.find('ServiceInfoDescription').length === 1).toBeTruthy();
      expect(wrapper.find('InfoRoutes').length === 1).toBeFalsy();
      expect(wrapper.find('ServiceInfoVirtualServices').length === 1).toBeTruthy();
      expect(wrapper.find('ServiceInfoDestinationRules').length === 1).toBeTruthy();
    });
  });
});
