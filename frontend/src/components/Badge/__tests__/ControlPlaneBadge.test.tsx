import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ControlPlaneBadge } from '../ControlPlaneBadge';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';

describe('ControlPlaneBadge', () => {
  it('renders the control plane badge', () => {
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <ControlPlaneBadge />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('CP')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });
});
