import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { TypePopoverBody, TypePopoverHeader } from '../TypeHeader';

jest.mock('utils/I18nUtils', () => ({
  useKialiTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('TypePopoverHeader', () => {
  it('renders namespace type heading', () => {
    render(<TypePopoverHeader />);
    expect(screen.getByText('Namespace type')).toBeInTheDocument();
  });
});

describe('TypePopoverBody', () => {
  it('renders without crashing', () => {
    const { container } = render(<TypePopoverBody />);
    expect(container).toBeTruthy();
  });

  it('contains CP (Control plane) description', () => {
    const { container } = render(<TypePopoverBody />);
    expect(container.textContent).toContain('CP');
    expect(container.textContent).toContain('Control plane');
    expect(container.textContent).toContain('Istio control plane');
  });

  it('contains DP (Data plane) description', () => {
    const { container } = render(<TypePopoverBody />);
    expect(container.textContent).toContain('DP');
    expect(container.textContent).toContain('Data plane');
    expect(container.textContent).toContain('Namespace is part of the mesh');
  });

  it('contains Empty description', () => {
    const { container } = render(<TypePopoverBody />);
    expect(container.textContent).toContain('Empty');
    expect(container.textContent).toContain('Namespace is not part of the mesh');
  });
});
