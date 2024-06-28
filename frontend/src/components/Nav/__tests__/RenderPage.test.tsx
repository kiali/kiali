import * as React from 'react';
import { mount } from 'enzyme';
import { NavigationComponent } from '../Navigation';
import { createMemoryHistory } from 'history';
import { ExternalServiceInfo } from '../../../types/StatusState';
import { RouterProvider, createMemoryRouter } from 'react-router-dom-v5-compat';

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
    const externalServicesInfo: ExternalServiceInfo[] = [];
    // const wrapper = shallow(
    //   <NavigationComponent
    //     history={history}
    //     location={graph}
    //     match={{ url: '', params: {}, path: '/graph', isExact: true }}
    //     navCollapsed={false}
    //     setNavCollapsed={() => {}}
    //     tracingUrl={''}
    //     externalServices={externalServicesInfo}
    //   />
    // ).dive();
    const router = createMemoryRouter([
      {
        element: (
          <NavigationComponent
            navCollapsed={false}
            setNavCollapsed={() => {}}
            tracingUrl={''}
            externalServices={externalServicesInfo}
          />
        )
      }
    ]);
    router.navigate('/graph');
    const wrapper = mount(<RouterProvider router={router} />);
    console.log(wrapper.debug());
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
    const externalServicesInfo: ExternalServiceInfo[] = [];
    // const wrapper = shallow(
    //   <NavigationComponent
    //     history={history}
    //     location={overview}
    //     match={{ url: '', params: {}, path: '/overview', isExact: true }}
    //     navCollapsed={false}
    //     setNavCollapsed={() => {}}
    //     tracingUrl={''}
    //     externalServices={externalServicesInfo}
    //   />
    // ).dive();
    const router = createMemoryRouter([
      {
        element: (
          <NavigationComponent
            navCollapsed={false}
            setNavCollapsed={() => {}}
            tracingUrl={''}
            externalServices={externalServicesInfo}
          />
        )
      }
    ]);
    router.navigate('/overview');
    const wrapper = mount(<RouterProvider router={router} />);
    console.log(wrapper.debug());
    expect(wrapper.find('RenderPage').prop('isGraph')).toEqual(false);
  });
});
