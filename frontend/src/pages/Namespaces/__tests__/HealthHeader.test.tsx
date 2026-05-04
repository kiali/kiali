import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { HealthPopoverBody, HealthPopoverHeader } from '../HealthHeader';

jest.mock('utils/I18nUtils', () => ({
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('HealthPopoverHeader', () => {
  it('renders namespace health heading', () => {
    render(<HealthPopoverHeader />);
    expect(screen.getByText('Namespace Health')).toBeInTheDocument();
  });
});

describe('HealthPopoverBody', () => {
  it('renders without crashing', () => {
    const { container } = render(<HealthPopoverBody />);
    expect(container).toBeTruthy();
  });

  it('contains aggregate state description', () => {
    const { container } = render(<HealthPopoverBody />);
    expect(container.textContent).toContain(
      'Health represents the aggregated status of all apps, services, and workloads within the namespace.'
    );
    expect(container.textContent).toContain("A namespace's status is determined by its lowest-performing component.");
  });

  it('contains Healthy status description', () => {
    const { container } = render(<HealthPopoverBody />);
    expect(container.textContent).toContain('Healthy');
    expect(container.textContent).toContain('All components operating normally and meeting all performance targets.');
  });

  it('contains Unhealthy status with sub-statuses', () => {
    const { container } = render(<HealthPopoverBody />);
    expect(container.textContent).toContain('Unhealthy');
    expect(container.textContent).toContain('One or more components are not working as expected, including:');
    expect(container.textContent).toContain('Failure');
    expect(container.textContent).toContain(
      'The component is in critical state and failing to meet basic requirements.'
    );
    expect(container.textContent).toContain('Degraded');
    expect(container.textContent).toContain('The component is functional but performing below optimal thresholds.');
    expect(container.textContent).toContain('Not ready');
    expect(container.textContent).toContain('The component exists but cannot serve traffic yet.');
  });

  it('contains n/a status description', () => {
    const { container } = render(<HealthPopoverBody />);
    expect(container.textContent).toContain('n/a');
    expect(container.textContent).toContain('No components available to monitor.');
  });
});
