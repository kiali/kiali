import * as React from 'react';
import { shallow } from 'enzyme';
import { ProxyStatusList } from '../ProxyStatusList';
import { ProxyStatus } from '../../../types/Health';
import { Stack, StackItem } from '@patternfly/react-core';
import { shallowToJson } from 'enzyme-to-json';

const syncedProxyStatus: ProxyStatus = {
  CDS: 'Synced',
  EDS: 'Synced',
  LDS: 'Synced',
  RDS: 'Synced'
};

const shallowComponent = (statuses: ProxyStatus) => {
  return shallow(<ProxyStatusList status={statuses} />);
};

describe('ProxyStatusList', () => {
  describe('when status is synced', () => {
    const subject = shallowComponent(syncedProxyStatus);

    it('does not render the stack', () => {
      expect(subject.find(Stack)).toHaveLength(0);
    });

    it('match the snapshot', () => {
      expect(shallowToJson(subject)).toMatchSnapshot();
    });
  });

  describe('when there are unsyced components', () => {
    const statuses: ProxyStatus = syncedProxyStatus;
    syncedProxyStatus.RDS = 'STALE';
    syncedProxyStatus.CDS = 'NOT_SENT';

    const subject = shallowComponent(statuses);

    it('match the snapshot', () => {
      expect(shallowToJson(subject)).toMatchSnapshot();
    });

    it('renders the stack', () => {
      const stack = subject.find(Stack);
      expect(stack).toHaveLength(1);
    });

    it('renders all unsynced statuses', () => {
      const stackItems = subject.find(StackItem);
      expect(stackItems).toHaveLength(3);
      expect(stackItems.at(0).html()).toContain('Istio Proxy Status');
      expect(stackItems.at(1).html()).toContain('CDS: NOT_SENT');
      expect(stackItems.at(2).html()).toContain('RDS: STALE');
    });
  });

  describe('when there are components without value', () => {
    const statuses: ProxyStatus = syncedProxyStatus;
    syncedProxyStatus.RDS = '';
    syncedProxyStatus.CDS = '';

    const subject = shallowComponent(statuses);

    it('match the snapshot', () => {
      expect(shallowToJson(subject)).toMatchSnapshot();
    });

    it('renders all unsynced statuses', () => {
      const stackItems = subject.find(StackItem);
      expect(stackItems).toHaveLength(3);
      expect(stackItems.at(0).html()).toContain('Istio Proxy Status');
      expect(stackItems.at(1).html()).toContain('CDS: -');
      expect(stackItems.at(2).html()).toContain('RDS: -');
    });
  });
});
