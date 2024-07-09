import * as React from 'react';
import { mount } from 'enzyme';
import { NavigationComponent } from '../Navigation';
import { ExternalServiceInfo } from '../../../types/StatusState';
import { Navigate, RouterProvider, createMemoryRouter } from 'react-router-dom-v5-compat';
import { defaultRoute, pathRoutes } from 'routes';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { LoginActions } from 'actions/LoginActions';

const session = {
  expiresOn: '2018-05-29 21:51:40.186179601 +0200 CEST m=+36039.431579761',
  username: 'admin'
};

const externalServicesInfo: ExternalServiceInfo[] = [];

const router = createMemoryRouter([
  {
    element: (
      <NavigationComponent
        navCollapsed={false}
        setNavCollapsed={() => {}}
        tracingUrl={''}
        externalServices={externalServicesInfo}
      />
    ),
    children: [...pathRoutes, { index: true, element: <Navigate to={defaultRoute} replace /> }]
  }
]);

describe('RenderPage isGraph prop', () => {
  it('be sure that RenderPage isGraph is true', () => {
    // we need a user session to render the navigation component
    store.dispatch(LoginActions.loginSuccess(session));

    router.navigate('/graph/namespaces');

    const wrapper = mount(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    );

    expect(wrapper.find('RenderPage').prop('isGraph')).toEqual(true);
  });

  it('be sure that RenderPage isGraph is false in other pages', () => {
    // we need a user session to render the navigation component
    store.dispatch(LoginActions.loginSuccess(session));

    router.navigate('/overview');

    const wrapper = mount(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    );

    expect(wrapper.find('RenderPage').prop('isGraph')).toEqual(false);
  });
});
