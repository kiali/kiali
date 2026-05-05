import * as React from 'react';
import { render } from '@testing-library/react';

import { DateTimePicker } from '../DateTimePicker';

describe('DateTimePicker', () => {
  it('renders correctly with no selected date', () => {
    const { container } = render(<DateTimePicker onChange={jest.fn()} />);
    expect(container).toMatchSnapshot();
  });

  it('renders correctly with selected date', () => {
    const selectedDate = new Date(2025, 5, 15, 14, 30); // June 15, 2025, 14:30
    const { container } = render(<DateTimePicker selected={selectedDate} onChange={jest.fn()} />);
    expect(container).toMatchSnapshot();
  });

  it('displays placeholder when no date is selected', () => {
    const { container } = render(<DateTimePicker onChange={jest.fn()} />);
    expect(container.innerHTML).toContain('YYYY-MM-DD');
    expect(container.innerHTML).toContain('HH:MM');
  });

  it('displays formatted date and time when selected', () => {
    const selectedDate = new Date(2025, 5, 15, 14, 30); // June 15, 2025, 14:30
    const { container } = render(<DateTimePicker selected={selectedDate} onChange={jest.fn()} />);
    expect(container.innerHTML).toContain('2025-06-15');
    expect(container.innerHTML).toContain('14:30');
  });

  it('accepts date as timestamp number', () => {
    const timestamp = new Date(2025, 5, 15, 14, 30).getTime();
    const { container } = render(<DateTimePicker selected={timestamp} onChange={jest.fn()} />);
    expect(container.innerHTML).toContain('2025-06-15');
    expect(container.innerHTML).toContain('14:30');
  });

  it('renders with min and max date constraints', () => {
    const minDate = new Date(2025, 5, 1);
    const maxDate = new Date(2025, 5, 30);
    const selectedDate = new Date(2025, 5, 15, 14, 30);
    const { container } = render(
      <DateTimePicker selected={selectedDate} minDate={minDate} maxDate={maxDate} onChange={jest.fn()} />
    );
    expect(container).toMatchSnapshot();
  });

  it('renders with data-test attribute for testing', () => {
    const { container } = render(<DateTimePicker onChange={jest.fn()} />);
    expect(container.innerHTML).toContain('data-test="date-time-picker"');
  });

  it('displays time in 24-hour format', () => {
    const morningDate = new Date(2025, 5, 15, 9, 5);
    const { container: c1, unmount: u1 } = render(<DateTimePicker selected={morningDate} onChange={jest.fn()} />);
    expect(c1.innerHTML).toContain('09:05');
    u1();

    const afternoonDate = new Date(2025, 5, 15, 15, 45);
    const { container: c2, unmount: u2 } = render(<DateTimePicker selected={afternoonDate} onChange={jest.fn()} />);
    expect(c2.innerHTML).toContain('15:45');
    u2();

    const midnightDate = new Date(2025, 5, 15, 0, 0);
    const { container: c3 } = render(<DateTimePicker selected={midnightDate} onChange={jest.fn()} />);
    expect(c3.innerHTML).toContain('00:00');
  });

  it('pads single digit months and days with zeros', () => {
    const date = new Date(2025, 0, 5, 14, 30); // January 5, 2025
    const { container } = render(<DateTimePicker selected={date} onChange={jest.fn()} />);
    expect(container.innerHTML).toContain('2025-01-05');
  });
});
