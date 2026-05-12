import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { LocalTime } from '../LocalTime';

describe('LocalTime', () => {
  it('renders "-" when time is empty', () => {
    render(<LocalTime time="" />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders "Unknown" for an invalid date string', () => {
    render(<LocalTime time="garbage" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders "Unknown" for year <= 1 (zero timestamp)', () => {
    render(<LocalTime time="0001-01-01T00:00:00Z" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('renders a formatted date for a valid timestamp', () => {
    render(<LocalTime time="2024-06-15T12:30:00Z" />);
    const text = screen.getByText(/2024|Jun/);
    expect(text).toBeInTheDocument();
  });
});
