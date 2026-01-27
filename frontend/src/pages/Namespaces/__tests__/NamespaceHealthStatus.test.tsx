import * as React from 'react';
import { mount } from 'enzyme';
import { Provider } from 'react-redux';
import { NamespaceHealthStatus } from '../NamespaceHealthStatus';
import { NamespaceStatus } from '../../../types/NamespaceInfo';
import { setServerConfig } from '../../../config/ServerConfig';
import { healthConfig } from '../../../types/__testData__/HealthConfig';
import { store } from '../../../store/ConfigStore';

describe('NamespaceHealthStatus', () => {
  beforeAll(() => {
    setServerConfig(healthConfig);
  });

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

  it('returns null when no status data is provided', () => {
    const wrapper = mount(
      <Provider store={store}>
        <NamespaceHealthStatus {...defaultProps} />
      </Provider>
    );

    // When wrapped in Provider, html() returns empty string instead of null
    // Check that no meaningful content is rendered
    expect(wrapper.text()).toBe('');
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
