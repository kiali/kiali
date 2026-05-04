import * as React from 'react';
import { render } from '@testing-library/react';
import { ProxyStatusList } from '../ProxyStatusList';
import { ProxyStatus } from '../../../types/Health';

const syncedProxyStatus: ProxyStatus = {
  CDS: 'Synced',
  EDS: 'Synced',
  LDS: 'Synced',
  RDS: 'Synced'
};

const renderList = (statuses: ProxyStatus): ReturnType<typeof render> => render(<ProxyStatusList status={statuses} />);

describe('ProxyStatusList', () => {
  describe('when status is synced', () => {
    it('does not render the stack', () => {
      const { container } = renderList(syncedProxyStatus);
      expect(container.querySelector('[class*="l-stack"]')).toBeNull();
    });

    it('match the snapshot', () => {
      const { container } = renderList(syncedProxyStatus);
      expect(container).toMatchSnapshot();
    });
  });

  describe('when there are unsyced components', () => {
    const statuses: ProxyStatus = {
      ...syncedProxyStatus,
      RDS: 'STALE',
      CDS: 'NOT_SENT'
    };

    it('match the snapshot', () => {
      const { container } = renderList(statuses);
      expect(container).toMatchSnapshot();
    });

    it('renders the stack', () => {
      const { container } = renderList(statuses);
      expect(container.querySelector('[class*="l-stack"]')).toBeTruthy();
    });

    it('renders all unsynced statuses', () => {
      const { container } = renderList(statuses);
      const stackItems = container.querySelectorAll('[class*="l-stack__item"]');
      expect(stackItems.length).toBe(3);
      expect(stackItems[0].textContent).toContain('Istio Proxy Status');
      expect(stackItems[1].textContent).toContain('CDS: NOT_SENT');
      expect(stackItems[2].textContent).toContain('RDS: STALE');
    });
  });

  describe('when there are components without value', () => {
    const statuses: ProxyStatus = {
      ...syncedProxyStatus,
      RDS: '',
      CDS: ''
    };

    it('match the snapshot', () => {
      const { container } = renderList(statuses);
      expect(container).toMatchSnapshot();
    });

    it('renders all unsynced statuses', () => {
      const { container } = renderList(statuses);
      const stackItems = container.querySelectorAll('[class*="l-stack__item"]');
      expect(stackItems.length).toBe(3);
      expect(stackItems[0].textContent).toContain('Istio Proxy Status');
      expect(stackItems[1].textContent).toContain('CDS: -');
      expect(stackItems[2].textContent).toContain('RDS: -');
    });
  });
});
