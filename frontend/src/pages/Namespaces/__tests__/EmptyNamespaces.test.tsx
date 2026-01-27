import * as React from 'react';
import { shallow, mount } from 'enzyme';
import { EmptyNamespaces } from '../EmptyNamespaces';
import { NamespaceInfo } from '../../../types/NamespaceInfo';
import { RefreshIntervalManual } from '../../../config/Config';

describe('EmptyNamespaces', () => {
  const mockNamespaces: NamespaceInfo[] = [
    {
      name: 'default',
      cluster: 'test-cluster',
      isAmbient: false,
      isControlPlane: false,
      labels: {},
      annotations: {},
      revision: undefined
    }
  ];

  describe('Manual refresh state', () => {
    it('renders manual refresh message when refresh is manual and not loaded', () => {
      const wrapper = mount(
        <EmptyNamespaces filteredNamespaces={mockNamespaces} loaded={false} refreshInterval={RefreshIntervalManual}>
          <div>Children</div>
        </EmptyNamespaces>
      );

      expect(wrapper.find('[data-test="manual-refresh"]').exists()).toBeTruthy();
      expect(wrapper.find('EmptyState').prop('titleText')).toBe('Manual refresh required');
    });

    it('does not render manual refresh message when loaded is true', () => {
      const wrapper = shallow(
        <EmptyNamespaces filteredNamespaces={mockNamespaces} loaded={true} refreshInterval={RefreshIntervalManual}>
          <div>Children</div>
        </EmptyNamespaces>
      );

      expect(wrapper.find('[data-test="manual-refresh"]').exists()).toBeFalsy();
    });

    it('does not render manual refresh message when refresh interval is not manual', () => {
      const wrapper = shallow(
        <EmptyNamespaces filteredNamespaces={mockNamespaces} loaded={false} refreshInterval={15000}>
          <div>Children</div>
        </EmptyNamespaces>
      );

      expect(wrapper.find('[data-test="manual-refresh"]').exists()).toBeFalsy();
    });
  });

  describe('Empty namespaces state', () => {
    it('renders empty namespaces message when filtered namespaces is empty', () => {
      const wrapper = mount(
        <EmptyNamespaces filteredNamespaces={[]} loaded={true} refreshInterval={15000}>
          <div>Children</div>
        </EmptyNamespaces>
      );

      expect(wrapper.find('EmptyState').prop('titleText')).toBe('No unfiltered namespaces');
    });

    it('does not render empty message when namespaces exist', () => {
      const wrapper = shallow(
        <EmptyNamespaces filteredNamespaces={mockNamespaces} loaded={true} refreshInterval={15000}>
          <div>Children</div>
        </EmptyNamespaces>
      );

      expect(wrapper.text()).not.toContain('No unfiltered namespaces');
    });
  });

  describe('Children rendering', () => {
    it('renders children when namespaces exist and loaded', () => {
      const wrapper = shallow(
        <EmptyNamespaces filteredNamespaces={mockNamespaces} loaded={true} refreshInterval={15000}>
          <div className="test-child">Children Content</div>
        </EmptyNamespaces>
      );

      expect(wrapper.find('.test-child').exists()).toBeTruthy();
      expect(wrapper.text()).toContain('Children Content');
    });

    it('does not render children when manual refresh is required', () => {
      const wrapper = shallow(
        <EmptyNamespaces filteredNamespaces={mockNamespaces} loaded={false} refreshInterval={RefreshIntervalManual}>
          <div className="test-child">Children Content</div>
        </EmptyNamespaces>
      );

      expect(wrapper.find('.test-child').exists()).toBeFalsy();
    });

    it('does not render children when namespaces are empty', () => {
      const wrapper = shallow(
        <EmptyNamespaces filteredNamespaces={[]} loaded={true} refreshInterval={15000}>
          <div className="test-child">Children Content</div>
        </EmptyNamespaces>
      );

      expect(wrapper.find('.test-child').exists()).toBeFalsy();
    });
  });

  describe('refreshInterval prop', () => {
    it('handles undefined refreshInterval gracefully', () => {
      const wrapper = shallow(
        <EmptyNamespaces filteredNamespaces={mockNamespaces} loaded={true}>
          <div>Children</div>
        </EmptyNamespaces>
      );

      expect(wrapper.exists()).toBeTruthy();
    });
  });
});
