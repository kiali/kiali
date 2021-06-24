import * as React from 'react';
import { mount, shallow } from 'enzyme';
import { IstioConfigItem } from '../../../types/IstioConfigList';
import IstioConfigCard from '../IstioConfigCard';
import { shallowToJson } from 'enzyme-to-json';
import IstioObjectLink from '../../Link/IstioObjectLink';

import { store } from '../../../store/ConfigStore';
import { Provider } from 'react-redux';
import { MemoryRouter, Route } from 'react-router';

const mockComponent = (name: string, items: IstioConfigItem[]) => {
  return <IstioConfigCard name={name} items={items} />;
};

const mountComponent = (name: string, items: IstioConfigItem[]) => {
  return mount(
    <Provider store={store}>
      <MemoryRouter>
        <Route render={() => mockComponent(name, items)} />
      </MemoryRouter>
    </Provider>
  );
};

describe('IstioConfigCard', () => {
  it('shows empty state when no items', () => {
    const card = mockComponent('reviews', []);

    expect(mount(card).text()).toContain('No Istio Config found for reviews');
    expect(shallowToJson(shallow(card))).toMatchSnapshot();
  });

  it('sort by type and name', () => {
    const name = 'reviews';
    const items = [
      { type: 'virtualservice', name: 'reviews-v9', namespace: 'bookinfo' },
      { type: 'sidecar', name: 'reviews-v9', namespace: 'bookinfo' },
      { type: 'destinationrule', name: 'reviews-v2', namespace: 'bookinfo' },
      { type: 'sidecar', name: 'reviews-v1', namespace: 'bookinfo' },
      { type: 'virtualservice', name: 'reviews-v8', namespace: 'bookinfo' },
      { type: 'sidecar', name: 'reviews-v3', namespace: 'bookinfo' },
      { type: 'destinationrule', name: 'reviews-v9', namespace: 'bookinfo' },
      { type: 'destinationrule', name: 'reviews-v8', namespace: 'bookinfo' },
      { type: 'virtualservice', name: 'reviews-v5', namespace: 'bookinfo' }
    ];

    const card = mockComponent(name, items);
    const shallowed = shallow(card);
    expect(shallowToJson(shallowed)).toMatchSnapshot();

    const mounted = mountComponent(name, items);
    const links = mounted.find(IstioObjectLink);

    expect(links.at(0).props()).toEqual({
      type: 'destinationrule',
      name: 'reviews-v2',
      namespace: 'bookinfo',
      children: 'reviews-v2'
    });
    expect(links.at(1).props()).toEqual({
      type: 'destinationrule',
      name: 'reviews-v8',
      namespace: 'bookinfo',
      children: 'reviews-v8'
    });
    expect(links.at(2).props()).toEqual({
      type: 'destinationrule',
      name: 'reviews-v9',
      namespace: 'bookinfo',
      children: 'reviews-v9'
    });
    expect(links.at(3).props()).toEqual({
      type: 'sidecar',
      name: 'reviews-v1',
      namespace: 'bookinfo',
      children: 'reviews-v1'
    });
    expect(links.at(4).props()).toEqual({
      type: 'sidecar',
      name: 'reviews-v3',
      namespace: 'bookinfo',
      children: 'reviews-v3'
    });
    expect(links.at(5).props()).toEqual({
      type: 'sidecar',
      name: 'reviews-v9',
      namespace: 'bookinfo',
      children: 'reviews-v9'
    });
    expect(links.at(6).props()).toEqual({
      type: 'virtualservice',
      name: 'reviews-v5',
      namespace: 'bookinfo',
      children: 'reviews-v5'
    });
    expect(links.at(7).props()).toEqual({
      type: 'virtualservice',
      name: 'reviews-v8',
      namespace: 'bookinfo',
      children: 'reviews-v8'
    });
    expect(links.at(8).props()).toEqual({
      type: 'virtualservice',
      name: 'reviews-v9',
      namespace: 'bookinfo',
      children: 'reviews-v9'
    });

    expect(links).toHaveLength(9);
  });
});
