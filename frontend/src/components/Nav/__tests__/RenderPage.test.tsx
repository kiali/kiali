import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { NavigationComponent } from '../Navigation';
import { ExternalServiceInfo } from '../../../types/StatusState';
import { RouterProvider, createMemoryRouter } from 'react-router-dom-v5-compat';
import { pathRoutes } from 'routes';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { LoginActions } from 'actions/LoginActions';
import { Theme } from 'types/Common';

jest.mock('../RenderPage', () => {
  (jest as any).requireActual('../RenderPage');
  const React = require('react');
  return {
    RenderPage: ({ isGraph }: { isGraph: boolean }) =>
      React.createElement('div', {
        'data-test': 'render-page-stub',
        'data-is-graph': isGraph ? 'true' : 'false'
      })
  };
});

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
        kiosk={''}
        theme={Theme.LIGHT}
        showNotificationCenter={false}
        chatbotEnabled={false}
      />
    ),
    children: pathRoutes
  }
]);

describe('RenderPage isGraph prop', () => {
  it('be sure that RenderPage isGraph is true', () => {
    // we need a user session to render the navigation component
    store.dispatch(LoginActions.loginSuccess(session));

    router.navigate('/graph/namespaces');

    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    );

    expect(screen.getByTestId('render-page-stub')).toHaveAttribute('data-is-graph', 'true');
  });

  it('be sure that RenderPage isGraph is false in other pages', () => {
    // we need a user session to render the navigation component
    store.dispatch(LoginActions.loginSuccess(session));

    router.navigate('/overview');

    render(
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    );

    expect(screen.getByTestId('render-page-stub')).toHaveAttribute('data-is-graph', 'false');
  });
});
