import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ModeBadge } from '../ModeBadge';

jest.mock('utils/I18nUtils', () => ({
  t: (key: string) => key
}));

describe('ModeBadge', () => {
  it('renders Ambient when mode is ambient', () => {
    render(<ModeBadge mode="ambient" />);
    expect(screen.getByText('Ambient')).toBeInTheDocument();
  });

  it('renders Sidecar when mode is sidecar', () => {
    render(<ModeBadge mode="sidecar" />);
    expect(screen.getByText('Sidecar')).toBeInTheDocument();
  });

  it('renders Not applicable when mode is none', () => {
    render(<ModeBadge mode="none" />);
    expect(screen.getByText('Not applicable')).toBeInTheDocument();
  });

  it('falls back to ambient when isAmbient is true and mode is not set', () => {
    render(<ModeBadge isAmbient={true} />);
    expect(screen.getByText('Ambient')).toBeInTheDocument();
  });

  it('falls back to sidecar when istioSidecar is true and mode is not set', () => {
    render(<ModeBadge istioSidecar={true} />);
    expect(screen.getByText('Sidecar')).toBeInTheDocument();
  });

  it('falls back to Not applicable when neither flag is set', () => {
    render(<ModeBadge />);
    expect(screen.getByText('Not applicable')).toBeInTheDocument();
  });

  it('mode prop takes precedence over boolean flags', () => {
    render(<ModeBadge mode="sidecar" isAmbient={true} />);
    expect(screen.getByText('Sidecar')).toBeInTheDocument();
    expect(screen.queryByText('Ambient')).not.toBeInTheDocument();
  });

  it('does not render popover info icon when popoverMessage is not provided', () => {
    const { container } = render(<ModeBadge mode="ambient" />);
    expect(container.querySelector('.pf-v6-c-popover')).toBeNull();
  });

  it('renders info icon when popoverMessage is provided', () => {
    const { container } = render(<ModeBadge mode="ambient" popoverMessage="Details here" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
