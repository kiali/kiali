import * as React from 'react';
import { mount } from 'enzyme';
import { NavigationComponent } from '../Navigation';
import { ExternalServiceInfo } from '../../../types/StatusState';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { store } from 'store/ConfigStore';
import { Provider } from 'react-redux';
import { LoginActions } from 'actions/LoginActions';
import { Theme } from 'types/Common';

const session = {
  expiresOn: '2018-05-29 21:51:40.186179601 +0200 CEST m=+36039.431579761',
  username: 'admin'
};

describe('Masthead Navigation', () => {
  beforeEach(() => {
    // we need a user session to render the navigation component
    store.dispatch(LoginActions.loginSuccess(session));
  });

  const externalServicesInfo: ExternalServiceInfo[] = [];

  it('renders Masthead and Sidebar when not in kiosk mode', () => {
    const wrapper = mount(
      <Provider store={store}>
        <MemoryRouter>
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
        </MemoryRouter>
      </Provider>
    );
    expect(wrapper.find('Masthead').exists()).toBe(true);
    expect(wrapper.find('PageSidebar').exists()).toBe(true);
  });

  it('hides Masthead and Sidebar when in kiosk mode', () => {
    const wrapper = mount(
      <Provider store={store}>
        <MemoryRouter>
          <NavigationComponent
            navCollapsed={false}
            setNavCollapsed={() => {}}
            tracingUrl={''}
            externalServices={externalServicesInfo}
            kiosk={'true'}
            theme={Theme.LIGHT}
            showNotificationCenter={false}
            chatbotEnabled={false}
          />
        </MemoryRouter>
      </Provider>
    );
    expect(wrapper.find('Masthead').exists()).toBe(false);
    expect(wrapper.find('PageSidebar').exists()).toBe(false);
  });
});
