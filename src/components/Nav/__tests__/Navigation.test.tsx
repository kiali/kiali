import * as React from 'react';
import { shallow } from 'enzyme';

import Navigation, { servicesTitle, istioConfigTitle } from '../Navigation';
import { VerticalNav } from 'patternfly-react';
import { RouteComponentProps } from 'react-router';

const getMockRouterProps = <P extends {}>(data: P) => {
  const location = {
    hash: '',
    key: '',
    pathname: '',
    search: '',
    state: {}
  };

  return {
    match: {
      isExact: true,
      params: data,
      path: '',
      url: ''
    },
    location: location,
    history: {
      length: 2,
      action: 'POP',
      location: location,
      push: () => undefined,
      replace: () => undefined,
      go: num => undefined,
      goBack: () => undefined,
      goForward: () => undefined,
      block: t => {
        return () => null;
      },
      createHref: t => {
        return '';
      },
      listen: t => {
        return () => null;
      }
    },
    staticContext: {}
  } as RouteComponentProps<P>;
};

const _tester = (path: string, expectedMenuPath: string) => {
  const routerProps = getMockRouterProps({});
  routerProps.location.pathname = path;

  const wrapper = shallow(
    <Navigation
      navCollapsed={false}
      setNavCollapsed={jest.fn()}
      jaegerUrl={''}
      enableIntegration={false}
      {...routerProps}
    />
  );

  const navWrapper = wrapper.find(VerticalNav.Item).findWhere(el => el.key() === path);
  expect(navWrapper.props()['active']).toBeTruthy();
};

describe('Navigation test', () => {
  it('should select menu item according to browser url', () => {
    _tester('/services', servicesTitle);
    _tester('/istio', istioConfigTitle);
  });
});
