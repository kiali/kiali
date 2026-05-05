import * as React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { BreadcrumbView } from '../BreadcrumbView';

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
    const { container } = render(
      <MemoryRouter initialEntries={['/namespaces/bookinfo']}>
        <BreadcrumbView />
      </MemoryRouter>
    );

    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].getAttribute('href')).toContain('/namespaces');
    expect(container.textContent).toContain('bookinfo');
  });

  it('renders workload breadcrumbs for entity detail URL', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/namespaces/bookinfo/workloads/reviews-v1']}>
        <BreadcrumbView />
      </MemoryRouter>
    );

    expect(container.textContent).toContain('bookinfo');
    expect(container.textContent).toContain('reviews-v1');
  });
});
