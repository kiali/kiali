import * as React from 'react';
import { shallow } from 'enzyme';
import ServiceInfoVirtualServices from '../ServiceInfoVirtualServices';
import { VirtualService } from '../../../../types/IstioObjects';

const virtualServices: VirtualService[] = [
  {
    metadata: {
      name: 'reviews-default',
      resourceVersion: '1234',
      creationTimestamp: '2018-03-14T10:17:52Z'
    },
    spec: {
      hosts: ['rewiews'],
      gateways: ['reviews'],
      http: [
        {
          route: [
            {
              destination: {
                subset: 'v1',
                host: 'reviews'
              },
              weight: 55
            },
            {
              destination: {
                subset: 'v3',
                host: 'reviews'
              },
              weight: 55
            }
          ]
        }
      ],
      tcp: [
        {
          match: [],
          route: [
            {
              destination: {
                subset: 'v1',
                host: 'reviews'
              },
              weight: 55
            },
            {
              destination: {
                subset: 'v2',
                host: 'reviews'
              },
              weight: 55
            }
          ]
        }
      ]
    }
  }
];

describe('#ServiceInfoVirtualServices render correctly with data', () => {
  it('should render service virtual services', () => {
    const wrapper = shallow(
      <ServiceInfoVirtualServices
        virtualServices={virtualServices}
        editorLink={'/namespaces/test_namespace/services/test_services'}
        validations={{}}
      />
    );
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
