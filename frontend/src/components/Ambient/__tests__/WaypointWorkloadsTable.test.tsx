import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { createStore } from 'redux';
import { WaypointType } from 'types/Ambient';
import { WaypointWorkloadsTable } from '../WaypointWorkloadsTable';

const store = createStore(() => ({ globalState: { kiosk: '' } }));

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={store}>
    <MemoryRouter>{children}</MemoryRouter>
  </Provider>
);

describe('WaypointWorkloadsTable', () => {
  it('sorts Services by label source in both directions without changing the input', async () => {
    const workloads = [
      { cluster: 'cluster-default', labelType: 'service', name: 'alpha', namespace: 'bookinfo' },
      { cluster: 'cluster-default', labelType: 'namespace', name: 'beta', namespace: 'bookinfo' },
      { cluster: 'cluster-default', name: 'gamma', namespace: 'bookinfo' }
    ];
    Object.freeze(workloads);
    const user = userEvent.setup();
    render(<WaypointWorkloadsTable type={WaypointType.Service} workloads={workloads} />, { wrapper: Wrapper });
    const names = (): string[] =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map(row => within(row).getByRole('link').textContent ?? '');

    expect(names()).toEqual(['alpha', 'beta', 'gamma']);
    await user.click(screen.getByRole('button', { name: 'Labeled by' }));
    expect(names()).toEqual(['gamma', 'beta', 'alpha']);
    expect(screen.getByRole('columnheader', { name: 'Labeled by' })).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: 'Labeled by' }));
    expect(names()).toEqual(['alpha', 'beta', 'gamma']);
    expect(screen.getByRole('columnheader', { name: 'Labeled by' })).toHaveAttribute('aria-sort', 'descending');
    expect(workloads.map(workload => workload.name)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it.each(['primary', 'canary'])('shows an explicit zero share for the %s role', role => {
    const { getByText } = render(
      <WaypointWorkloadsTable
        type={WaypointType.Service}
        workloads={[
          {
            cluster: 'cluster-default',
            labelType: 'service',
            name: 'reviews',
            namespace: 'bookinfo',
            roleWeight: 0,
            waypointRole: role
          }
        ]}
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('Waypoint role')).toBeTruthy();
    expect(getByText(role === 'primary' ? 'Primary (0%)' : 'Canary (0%)')).toBeTruthy();
  });

  it('omits the role column when no canary split applies', () => {
    const { queryByText } = render(
      <WaypointWorkloadsTable
        type={WaypointType.Service}
        workloads={[
          {
            cluster: 'cluster-default',
            labelType: 'namespace',
            name: 'reviews',
            namespace: 'bookinfo',
            waypointRole: 'primary'
          }
        ]}
      />,
      { wrapper: Wrapper }
    );

    expect(queryByText('Waypoint role')).toBeNull();
    expect(queryByText('Primary (0%)')).toBeNull();
  });
});
