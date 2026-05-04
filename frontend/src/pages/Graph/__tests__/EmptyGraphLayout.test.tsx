import * as React from 'react';
import { shallow } from 'enzyme';
import { EmptyGraphLayout } from '../EmptyGraphLayout';
import { serverConfig, setServerConfig } from '../../../config/ServerConfig';

describe('EmptyGraphLayout', () => {
  const defaultProps = {
    isError: false,
    isMiniGraph: false,
    loaded: true,
    namespaces: [{ name: 'default' }],
    refreshInterval: 15000,
    showIdleNodes: false,
    toggleIdleNodes: jest.fn()
  };

  afterEach(() => {
    setServerConfig({
      ...serverConfig,
      prometheus: { ...serverConfig.prometheus, enabled: true, disabledReason: undefined }
    });
  });

  it('shows prometheus disabled message when prometheus is explicitly disabled', () => {
    setServerConfig({ ...serverConfig, prometheus: { ...serverConfig.prometheus, enabled: false } });

    const wrapper = shallow(<EmptyGraphLayout {...defaultProps} />);

    expect(wrapper.find('#empty-graph-prometheus-disabled').exists()).toBe(true);
    expect(wrapper.html()).toContain('Metrics are disabled');
  });

  it('shows prometheus disabled message when prometheus is enabled but unreachable', () => {
    setServerConfig({
      ...serverConfig,
      prometheus: { ...serverConfig.prometheus, enabled: true, disabledReason: 'Prometheus unreachable' }
    });

    const wrapper = shallow(<EmptyGraphLayout {...defaultProps} />);

    expect(wrapper.find('#empty-graph-prometheus-disabled').exists()).toBe(true);
    expect(wrapper.html()).toContain('Metrics are disabled');
  });

  it('does not show prometheus disabled message when prometheus is enabled', () => {
    setServerConfig({ ...serverConfig, prometheus: { ...serverConfig.prometheus, enabled: true } });

    const wrapper = shallow(
      <EmptyGraphLayout {...defaultProps}>
        <div id="graph-content">Graph Content</div>
      </EmptyGraphLayout>
    );

    expect(wrapper.find('#empty-graph-prometheus-disabled').exists()).toBe(false);
  });
});
