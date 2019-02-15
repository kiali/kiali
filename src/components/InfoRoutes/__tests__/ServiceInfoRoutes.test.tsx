import * as React from 'react';
import { render } from 'enzyme';
import { ServiceInfoRoutes } from '../ServiceInfoRoutes';
import { BrowserRouter as Router } from 'react-router-dom';

let wrapper;

describe('#ServiceInfoRoutes render correctly with data', () => {
  beforeEach(() => {
    const dependencies = {
      v1: [{ namespace: 'bookinfo', name: 'reviews-v1' }, { namespace: 'istio-system', name: 'istio-citadel' }]
    };

    wrapper = render(
      <Router>
        <div>
          <ServiceInfoRoutes dependencies={dependencies} />
        </div>
      </Router>
    );
  });

  it('renders', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('shows properly the from header', () => {
    const destinationElem = wrapper.find('.progress-description > strong');
    expect(destinationElem[0].children[0].data).toEqual('To: ');
    expect(destinationElem[0].next.data).toEqual(' v1');
  });

  it('renders service routes', () => {
    const expectationData = {
      'reviews-v1': { href: '/namespaces/bookinfo/workloads/reviews-v1' },
      'istio-citadel': { href: '/namespaces/istio-system/workloads/istio-citadel' }
    };

    wrapper.find('a').each((index, selector) => {
      const serviceName = selector.children[0].data;
      expect(serviceName).toBeDefined();
      if (!serviceName) {
        return;
      }
      expect(selector.attribs['href']).toEqual(expectationData[serviceName]['href']);
    });
  });
});
