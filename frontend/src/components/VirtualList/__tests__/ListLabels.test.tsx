import { fireEvent, render, screen, within } from '@testing-library/react';
import { getFiltersFromURL } from 'components/FilterList/FilterHelper';
import { getPagePath } from 'utils/NavigationUtils';
import type { StatefulFiltersRef } from 'components/Filters/StatefulFilters';
import { labelFilter } from 'components/Filters/CommonFilters';
import { labelFilter as namespaceLabelFilter } from 'pages/Namespaces/Filters';
import { ListLabels } from '../ListLabels';
import { labels as renderLabels } from '../Renderers';
import type { Resource, SortResource } from '../Config';
import { PFBadges } from 'components/Pf/PfBadges';

rstest.mock('../Config', () => ({}));

rstest.mock('store/ConfigStore', () => ({
  store: {
    getState: () => ({ globalState: { kiosk: '' } }),
    dispatch: rstest.fn(),
    subscribe: rstest.fn(),
    replaceReducer: rstest.fn()
  },
  persistor: { persist: rstest.fn() }
}));

rstest.mock('components/FilterList/FilterHelper', () => ({
  getFiltersFromURL: rstest.fn(() => ({ filters: [], op: 'or' }))
}));

rstest.mock('utils/NavigationUtils', () => ({
  getPagePath: rstest.fn(() => 'workloads')
}));

rstest.mock('utils/I18nUtils', () => ({
  t: (key: string, options?: { count: number }) => (options ? key.replace('{{count}}', String(options.count)) : key)
}));

describe('ListLabels', () => {
  beforeEach(() => {
    rstest.mocked(getFiltersFromURL).mockReset();
    rstest.mocked(getFiltersFromURL).mockReturnValue({ filters: [], op: 'or' });
    rstest.mocked(getPagePath).mockReturnValue('workloads');
  });

  it('prioritizes labels with istio in the key, ignoring case and not matching values', () => {
    render(
      <ListLabels
        labels={{
          app: 'istio',
          'ISTIO.io/rev': 'default',
          'example.com/MyIstioLabel': 'enabled',
          version: 'v1'
        }}
      />
    );

    expect(screen.getByText('ISTIO.io/rev=default')).toBeInTheDocument();
    expect(screen.getByText('example.com/MyIstioLabel=enabled')).toBeInTheDocument();
    expect(screen.queryByText('app=istio')).not.toBeInTheDocument();
    expect(screen.queryByText('version=v1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 more' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps Istio labels ahead of numeric keys and sorts numeric keys alphabetically', () => {
    const { container } = render(<ListLabels labels={{ '2': 'two', '10': 'ten', 'istio.io/rev': 'default' }} />);

    expect(screen.getByText('istio.io/rev=default')).toBeInTheDocument();
    expect(screen.getByText('10=ten')).toBeInTheDocument();
    expect(screen.queryByText('2=two')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1 more' }));

    const chipText = Array.from(container.querySelectorAll('.pf-v6-c-label__text')).map(node => node.textContent);
    expect(chipText).toEqual(['istio.io/rev=default', '10=ten', '2=two']);
  });

  it('only mounts two chips for a resource with thousands of labels', () => {
    const labels: Record<string, string> = { 'istio.io/rev': 'default' };
    for (let i = 0; i < 2000; i++) {
      labels[`example.com/label-${i}`] = `value-${i}`;
    }
    const { container } = render(<ListLabels labels={labels} />);

    expect(container.querySelectorAll('.pf-v6-c-label')).toHaveLength(2);
    expect(screen.getByText('istio.io/rev=default')).toBeInTheDocument();
    expect(screen.getByText('example.com/label-0=value-0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1999 more' })).toBeInTheDocument();
    expect(screen.queryByText('example.com/label-1=value-1')).not.toBeInTheDocument();
  });

  it('caps initial rendering at two even when every label is an Istio label', () => {
    const labels: Record<string, string> = {};
    for (let i = 0; i < 2000; i++) {
      labels[`istio.io/label-${i}`] = `value-${i}`;
    }
    const { container } = render(<ListLabels labels={labels} />);

    expect(container.querySelectorAll('.pf-v6-c-label')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '1998 more' })).toBeInTheDocument();
    expect(screen.queryByText('istio.io/label-2=value-2')).not.toBeInTheDocument();
  });

  it('expands only the requested row and unmounts additional labels when collapsed', () => {
    render(
      <>
        <div data-test="first-row">
          <ListLabels labels={{ app: 'first', 'istio.io/rev': 'default', version: 'v1' }} />
        </div>
        <div data-test="second-row">
          <ListLabels labels={{ app: 'second', 'istio.io/rev': 'canary', version: 'v2' }} />
        </div>
      </>
    );
    const firstRow = within(screen.getByTestId('first-row'));
    const secondRow = within(screen.getByTestId('second-row'));

    fireEvent.click(firstRow.getByRole('button', { name: '1 more' }));

    expect(firstRow.getByText('version=v1')).toBeInTheDocument();
    expect(firstRow.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    expect(secondRow.queryByText('version=v2')).not.toBeInTheDocument();
    expect(secondRow.getByRole('button', { name: '1 more' })).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(firstRow.getByRole('button', { name: 'Show less' }));

    expect(firstRow.queryByText('version=v1')).not.toBeInTheDocument();
    expect(firstRow.getByText('istio.io/rev=default')).toBeInTheDocument();
  });

  it('reveals all remaining labels in a single click', () => {
    const labels: Record<string, string> = { 'istio.io/rev': 'default' };
    for (let i = 0; i < 25; i++) {
      labels[`example.com/label-${i}`] = `value-${i}`;
    }
    const { container } = render(<ListLabels labels={labels} />);

    expect(container.querySelectorAll('.pf-v6-c-label')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '24 more' }));
    expect(container.querySelectorAll('.pf-v6-c-label')).toHaveLength(26);
    expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(container.querySelectorAll('.pf-v6-c-label')).toHaveLength(2);
  });

  it('shows the first two alphabetical labels when there are no Istio labels', () => {
    const { container } = render(<ListLabels labels={{ version: 'v1', app: 'bookinfo', team: 'mesh' }} />);

    expect(container.querySelectorAll('.pf-v6-c-label')).toHaveLength(2);
    expect(screen.getByText('app=bookinfo')).toBeInTheDocument();
    expect(screen.getByText('team=mesh')).toBeInTheDocument();
    expect(screen.queryByText('version=v1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1 more' }));
    expect(screen.getByText('version=v1')).toBeInTheDocument();
  });

  const smallLabelSets: Record<string, string>[] = [
    { 'istio.io/rev': 'default' },
    { 'istio.io/rev': 'default', 'sidecar.istio.io/inject': 'true' },
    { app: 'bookinfo', version: 'v1' },
    { app: 'bookinfo', 'istio.io/rev': 'default' }
  ];

  it.each(smallLabelSets)('does not show an expansion control when there are at most two labels (%s)', labels => {
    const { container } = render(<ListLabels labels={labels} />);

    expect(container.querySelectorAll('.pf-v6-c-label')).toHaveLength(Object.keys(labels).length);
    expect(screen.queryByRole('button', { name: /more|Show less/ })).not.toBeInTheDocument();
  });

  it.each([undefined, {}])('does not show chips or an expansion control for missing or empty labels (%s)', labels => {
    const { container } = render(<ListLabels labels={labels} />);

    expect(container.querySelectorAll('.pf-v6-c-label')).toHaveLength(0);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sorts Istio labels first and other labels second, alphabetically within each group', () => {
    const { container } = render(
      <ListLabels labels={{ zebra: 'z', 'z.istio.io/key': 'z', app: 'a', 'a.istio.io/key': 'a' }} />
    );
    fireEvent.click(screen.getByRole('button', { name: '2 more' }));

    const chipText = Array.from(container.querySelectorAll('.pf-v6-c-label__text')).map(node => node.textContent);
    expect(chipText).toEqual(['a.istio.io/key=a', 'z.istio.io/key=z', 'app=a', 'zebra=z']);
  });

  it('keeps the full-text tooltip for truncated chips without the filtering tooltip', async () => {
    const width = rstest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    const contentWidth = rstest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(300);
    const statefulFilter = { current: { filterAdded: rstest.fn() } } as unknown as StatefulFiltersRef;
    const value = 'a-long-value-that-does-not-fit-in-the-chip';

    try {
      render(<ListLabels labels={{ 'istio.io/rev': value }} statefulFilter={statefulFilter} />);
      const chip = screen.getByRole('button', { name: `istio.io/rev=${value}` });

      fireEvent.mouseEnter(chip.closest('.pf-v6-c-label')!);
      fireEvent.mouseEnter(chip);

      expect(await screen.findByRole('tooltip')).toHaveTextContent(`istio.io/rev=${value}`);
      expect(screen.queryByText('Add label to Filters')).not.toBeInTheDocument();
    } finally {
      width.mockRestore();
      contentWidth.mockRestore();
    }
  });

  it('preserves click-to-filter for labels revealed by expanding a row', () => {
    const filterAdded = rstest.fn();
    const statefulFilter = { current: { filterAdded } } as unknown as StatefulFiltersRef;
    render(
      <ListLabels
        labels={{ app: 'bookinfo', 'a.istio.io/rev': 'default', 'b.istio.io/inject': 'true' }}
        statefulFilter={statefulFilter}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '1 more' }));
    fireEvent.click(screen.getByRole('button', { name: 'app=bookinfo' }));

    expect(filterAdded).toHaveBeenCalledWith(labelFilter, 'app=bookinfo');
  });

  it('preserves active-label highlighting and removal without reparsing filters for every label', () => {
    const removeFilter = rstest.fn();
    const statefulFilter = { current: { removeFilter } } as unknown as StatefulFiltersRef;
    rstest.mocked(getFiltersFromURL).mockReturnValue({
      filters: [{ category: labelFilter.category, value: 'istio.io/rev=default' }],
      op: 'or'
    });
    const { container } = render(
      <ListLabels
        labels={{ 'istio.io/rev': 'default', 'sidecar.istio.io/inject': 'true' }}
        statefulFilter={statefulFilter}
      />
    );

    expect(container.querySelectorAll('.pf-v6-c-label.pf-m-yellow')).toHaveLength(1);
    expect(getFiltersFromURL).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'istio.io/rev=default' }));
    expect(removeFilter).toHaveBeenCalledWith(labelFilter.category, 'istio.io/rev=default');
  });

  it('does not transfer expansion to a resource with the same name in another cluster', () => {
    const renderRow = (cluster: string): JSX.Element => (
      <table>
        <tbody>
          <tr>
            {renderLabels(
              {
                name: 'details',
                namespace: 'bookinfo',
                cluster,
                labels: { app: 'bookinfo', team: 'mesh', version: cluster }
              } as unknown as SortResource,
              {} as Resource,
              PFBadges.Workload
            )}
          </tr>
        </tbody>
      </table>
    );
    const { rerender } = render(renderRow('east'));
    fireEvent.click(screen.getByRole('button', { name: '1 more' }));
    expect(screen.getByText('version=east')).toBeInTheDocument();

    rerender(renderRow('west'));

    expect(screen.queryByText('version=west')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 more' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses the namespace label filter on the namespace list', () => {
    const filterAdded = rstest.fn();
    const statefulFilter = { current: { filterAdded } } as unknown as StatefulFiltersRef;
    rstest.mocked(getPagePath).mockReturnValue('namespaces');
    render(<ListLabels labels={{ 'istio.io/rev': 'default' }} statefulFilter={statefulFilter} />);

    fireEvent.click(screen.getByRole('button', { name: 'istio.io/rev=default' }));

    expect(filterAdded).toHaveBeenCalledWith(namespaceLabelFilter, 'istio.io/rev=default');
  });
});
