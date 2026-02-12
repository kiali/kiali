import * as React from 'react';
import { mount } from 'enzyme';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { NamespaceHealthStatus } from '../NamespaceHealthStatus';
import { NamespaceStatus } from '../../../types/NamespaceInfo';
import { setServerConfig } from '../../../config/ServerConfig';
import { healthConfig } from '../../../types/__testData__/HealthConfig';
import { naTextStyle } from 'styles/HealthStyle';
import { namespaceNaIconStyle } from '../NamespaceStyle';

jest.mock('utils/NavigationUtils', () => ({
  kialiNavigate: jest.fn()
}));

describe('NamespaceHealthStatus', () => {
  beforeAll(() => {
    setServerConfig(healthConfig);
  });

  const store = createStore(
    // Minimal reducer/store for this connected component. Avoid importing the real ConfigStore (which pulls Mesh + ESM deps).
    (state = {}) => state,
    {
      globalState: { kiosk: '' },
      userSettings: { duration: 600, refreshInterval: 10000 }
    } as any
  );

  const defaultProps = {
    name: 'test-namespace'
  };

  it('renders Healthy when all statuses are healthy', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: ['app1'],
      notAvailable: []
    };

    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} statusApp={statusApp} />
      </Provider>
    );

    expect(wrapper.text()).toContain('Healthy');
    expect(wrapper.find('[data-test="namespace-health-details-trigger"]').exists()).toBeFalsy();
  });

  it('renders Unhealthy when there are errors', () => {
    const statusApp: NamespaceStatus = {
      inError: ['app1'],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: []
    };

    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} statusApp={statusApp} />
      </Provider>
    );

    expect(wrapper.text()).toContain('Unhealthy');
    expect(wrapper.text()).toContain('1 issue');
    expect(wrapper.find('[data-test="namespace-health-details-trigger"]').exists()).toBeTruthy();
  });

  it('renders Unhealthy when there are warnings', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: ['app1'],
      inNotReady: [],
      inSuccess: [],
      notAvailable: []
    };

    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} statusApp={statusApp} />
      </Provider>
    );

    expect(wrapper.text()).toContain('Unhealthy');
    expect(wrapper.text()).toContain('1 issue');
  });

  it('renders n/a when worst status is NA', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['app1']
    };

    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} statusApp={statusApp} />
      </Provider>
    );

    expect(wrapper.text()).toContain('n/a');
    expect(wrapper.text()).not.toContain('Unhealthy');
    expect(wrapper.text()).not.toContain('Healthy');
    expect(wrapper.text()).not.toContain('issue');
  });

  it('renders n/a when only notAvailable items exist across all status types', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['app1']
    };

    const statusService: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['svc1']
    };

    const statusWorkload: NamespaceStatus = {
      inError: [],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['wl1']
    };

    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus
          {...defaultProps}
          statusApp={statusApp}
          statusService={statusService}
          statusWorkload={statusWorkload}
        />
      </Provider>
    );

    expect(wrapper.text()).toContain('n/a');
    expect(wrapper.text()).not.toContain('Unhealthy');
    expect(wrapper.text()).not.toContain('Healthy');
    expect(wrapper.text()).not.toContain('issue');
  });

  it('renders Unhealthy when there are errors even if notAvailable items exist', () => {
    const statusApp: NamespaceStatus = {
      inError: ['app1'],
      inWarning: [],
      inNotReady: [],
      inSuccess: [],
      notAvailable: ['app2']
    };

    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} statusApp={statusApp} />
      </Provider>
    );

    expect(wrapper.text()).toContain('Unhealthy');
    expect(wrapper.text()).not.toContain('n/a');
    expect(wrapper.text()).toContain('1 issue');
  });

  it('renders n/a when no status data is provided (and uses subtle/disabled colors)', () => {
    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} />
      </Provider>
    );

    expect(wrapper.text()).toContain('n/a');

    // n/a text color
    const naText = wrapper
      .find('div')
      .filterWhere(d => d.text() === 'n/a' && d.hasClass(naTextStyle))
      .first();
    expect(naText.exists()).toBeTruthy();
    expect(naText.hasClass(naTextStyle)).toBeTruthy();

    // NA icon color (createIcon(NA) yields a span with icon-na class)
    const naIcon = wrapper.find('span.icon-na').first();
    expect(naIcon.exists()).toBeTruthy();
    // Don't assume a fixed DOM nesting for PatternFly Icon - just ensure the NA icon is within the disabled-color wrapper.
    expect(wrapper.find(`.${namespaceNaIconStyle} span.icon-na`).exists()).toBeTruthy();
  });

  it('prioritizes FAILURE over other statuses', () => {
    const statusApp: NamespaceStatus = {
      inError: ['app1'],
      inWarning: ['app2'],
      inNotReady: ['app3'],
      inSuccess: ['app4'],
      notAvailable: ['app5']
    };

    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} statusApp={statusApp} />
      </Provider>
    );

    expect(wrapper.text()).toContain('Unhealthy');
    expect(wrapper.text()).toContain('3 issues');
  });

  it('prioritizes DEGRADED over HEALTHY and NA', () => {
    const statusApp: NamespaceStatus = {
      inError: [],
      inWarning: ['app1'],
      inNotReady: [],
      inSuccess: ['app2'],
      notAvailable: ['app3']
    };

    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} statusApp={statusApp} />
      </Provider>
    );

    expect(wrapper.text()).toContain('Unhealthy');
    expect(wrapper.text()).toContain('1 issue');
  });
});
