import * as React from 'react';
import { shallow } from 'enzyme';
import { NavigationComponent } from '../Navigation';
import { createMemoryHistory, createLocation } from 'history';
import { ExternalServiceInfo } from '../../../types/StatusState';

describe('Masthead Navigation', () => {
  it('be sure Masthead has a role', () => {
    const history = createMemoryHistory();
    const url = 'http://localhost:3000/console/overview';
    history.push('/overview');
    const externalServicesInfo: ExternalServiceInfo[] = [];
    const wrapper = shallow(
      <NavigationComponent
        history={history}
        location={createLocation(new URL(url))}
        match={{ url: url, params: {}, path: '/overview', isExact: true }}
        navCollapsed={false}
        setNavCollapsed={() => {}}
        tracingUrl={''}
        externalServices={externalServicesInfo}
      />
    ).dive();
    expect(wrapper.find('Masthead').props().role).toEqual('kiali_header');
  });
});
