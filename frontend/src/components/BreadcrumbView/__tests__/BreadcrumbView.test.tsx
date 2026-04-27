import * as React from 'react';
import { mount } from 'enzyme';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { BreadcrumbView } from '../BreadcrumbView';
import { Link } from 'react-router-dom-v5-compat';

jest.mock('../../Filters/StatefulFilters', () => ({
  FilterSelected: { resetFilters: jest.fn() }
}));

jest.mock('../../../app/History', () => ({
  HistoryManager: {
    getClusterName: jest.fn(() => undefined)
  }
}));

describe('BreadcrumbView', () => {
  it('renders Namespaces list and namespace for namespace detail URL', () => {
    const wrapper = mount(
      <MemoryRouter initialEntries={['/namespaces/bookinfo']}>
        <BreadcrumbView />
      </MemoryRouter>
    );

    const links = wrapper.find(Link);
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links.at(0).prop('to')).toContain('/namespaces');
    expect(wrapper.text()).toContain('bookinfo');
  });

  it('renders workload breadcrumbs for entity detail URL', () => {
    const wrapper = mount(
      <MemoryRouter initialEntries={['/namespaces/bookinfo/workloads/reviews-v1']}>
        <BreadcrumbView />
      </MemoryRouter>
    );

    expect(wrapper.text()).toContain('bookinfo');
    expect(wrapper.text()).toContain('reviews-v1');
  });
});
