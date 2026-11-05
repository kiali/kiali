import * as React from 'react';
import { render } from '@testing-library/react';
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
