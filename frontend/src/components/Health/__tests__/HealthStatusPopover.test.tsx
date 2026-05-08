import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { HealthStatusPopover } from '../HealthStatusPopover';

jest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key
}));

const mockHealth = (statusName: string, isHealthy: boolean): object => ({
  getStatus: () => ({
    name: statusName,
    id: isHealthy ? 'Healthy' : 'Failure',
    className: isHealthy ? 'icon-healthy' : 'icon-failure',
    color: '#000',
    icon: () => null,
    priority: isHealthy ? 4 : 1,
    status: isHealthy ? 'success' : 'danger'
  })
});

describe('HealthStatusPopover', () => {
  it('renders NA status when health is undefined', (): void => {
    render(<HealthStatusPopover />);
    expect(screen.getByText('n/a')).toBeInTheDocument();
  });

  it('renders status name from healthy health object', (): void => {
    render(<HealthStatusPopover health={mockHealth('Healthy', true) as any} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('renders status name from unhealthy health object', (): void => {
    render(<HealthStatusPopover health={mockHealth('Failure', false) as any} />);
    expect(screen.getByText('Failure')).toBeInTheDocument();
  });
});
