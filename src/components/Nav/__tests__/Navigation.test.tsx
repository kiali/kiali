import * as React from 'react';
import { shallow } from 'enzyme';

import Navigation, { servicesTitle, istioConfigTitle } from '../Navigation';
import { VerticalNav } from 'patternfly-react';
import { kialiRoute, routes } from '../../../routes';

const _tester = (path: string, expectedMenuPath: string) => {
  const wrapper = shallow(
    <Navigation
      location={{ pathname: path }}
      authenticated={true}
      checkCredentials={jest.fn()}
      navCollapsed={false}
      setNavCollapsed={jest.fn()}
    />
  );

  const navWrapper = wrapper.find(VerticalNav.Item).findWhere(el => el.key() === path);
  expect(navWrapper.props()['active']).toBeTruthy();
};

describe('Navigation test', () => {
  it('should select menu item according to browser url', () => {
    _tester(kialiRoute('/services'), servicesTitle);
    _tester(kialiRoute('/istio'), istioConfigTitle);
  });

  it('should have only one redirect', () => {
    expect(routes.filter(path => path.redirect === true)).toHaveLength(1);
  });
});
