import * as React from 'react';
import { shallow } from 'enzyme';
import { Navigation } from '../Navigation';
import { createMemoryHistory } from 'history';

const history = createMemoryHistory();

describe('RenderPage isGraph prop', () => {
  it('be sure that RenderPage isGraph is true', () => {
    const graph = {
      pathname: '/graph',
      search: '',
      state: undefined,
      hash: ''
    };
    history.push(graph);
    const wrapper = shallow(
      <Navigation
        history={history}
        location={graph}
        match={{ url: '', params: {}, path: '/graph', isExact: true }}
        navCollapsed={false}
        setNavCollapsed={() => {}}
        jaegerUrl={''}
      />
    ).dive();
    expect(wrapper.find('RenderPage').prop('isGraph')).toEqual(true);
  });

  it('be sure that RenderPage isGraph is false in other pages', () => {
    const overview = {
      pathname: '/overview',
      search: '',
      state: undefined,
      hash: ''
    };
    history.push(overview);
    const wrapper = shallow(
      <Navigation
        history={history}
        location={overview}
        match={{ url: '', params: {}, path: '/overview', isExact: true }}
        navCollapsed={false}
        setNavCollapsed={() => {}}
        jaegerUrl={''}
      />
    ).dive();
    expect(wrapper.find('RenderPage').prop('isGraph')).toEqual(false);
  });
});
