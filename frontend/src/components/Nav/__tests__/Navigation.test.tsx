import * as React from 'react';
import { mount } from 'enzyme';
import { NavigationComponent } from '../Navigation';
import { ExternalServiceInfo } from '../../../types/StatusState';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { store } from 'store/ConfigStore';
import { Provider } from 'react-redux';
import { LoginActions } from 'actions/LoginActions';

const session = {
  expiresOn: '2018-05-29 21:51:40.186179601 +0200 CEST m=+36039.431579761',
  username: 'admin'
};

describe('Masthead Navigation', () => {
  it('be sure Masthead has a role', () => {
    // we need a user session to render the navigation component
    store.dispatch(LoginActions.loginSuccess(session));

    const externalServicesInfo: ExternalServiceInfo[] = [];
    const wrapper = mount(
      <Provider store={store}>
        <MemoryRouter>
          <NavigationComponent
            navCollapsed={false}
            setNavCollapsed={() => {}}
            tracingUrl={''}
            externalServices={externalServicesInfo}
          />
        </MemoryRouter>
      </Provider>
    );
    expect(wrapper.find('Masthead').props().role).toEqual('kiali_header');
  });
});
