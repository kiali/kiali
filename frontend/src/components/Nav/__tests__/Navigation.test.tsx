import * as React from 'react';
import { shallow } from 'enzyme';
import { Navigation } from '../Navigation';
import { createMemoryHistory, createLocation } from 'history';

describe('PageHeader Navigation', () => {
  it('be sure PageHeader has a role', () => {
    const history = createMemoryHistory();
    const url = 'http://localhost:3000/console/overview';
    history.push('/overview');
    const wrapper = shallow(
      <Navigation
        history={history}
        location={createLocation(new URL(url))}
        match={{ url: url, params: {}, path: '/overview', isExact: true }}
        navCollapsed={false}
        setNavCollapsed={() => {}}
        jaegerUrl={''}
      />
    ).dive();
    expect(wrapper.find('PageHeader').props().role).toEqual('kiali_header');
  });
});
