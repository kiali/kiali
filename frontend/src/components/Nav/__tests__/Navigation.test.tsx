import * as React from 'react';
import { mount } from 'enzyme';
import { NavigationComponent } from '../Navigation';
import { ExternalServiceInfo } from '../../../types/StatusState';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { store } from 'store/ConfigStore';
import { Provider } from 'react-redux';

describe('Masthead Navigation', () => {
  it('be sure Masthead has a role', () => {
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
