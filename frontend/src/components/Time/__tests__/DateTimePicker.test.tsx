import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import { DateTimePicker } from '../DateTimePicker';

describe('DateTimePicker', () => {
  it('renders correctly with no selected date', () => {
    const wrapper = shallow(<DateTimePicker onChange={jest.fn()} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('renders correctly with selected date', () => {
    const selectedDate = new Date(2025, 5, 15, 14, 30); // June 15, 2025, 14:30
    const wrapper = shallow(<DateTimePicker selected={selectedDate} onChange={jest.fn()} />);
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('displays placeholder when no date is selected', () => {
    const wrapper = shallow(<DateTimePicker onChange={jest.fn()} />);
    const html = wrapper.html();
    expect(html).toContain('YYYY-MM-DD');
    expect(html).toContain('HH:MM');
  });

  it('displays formatted date and time when selected', () => {
    const selectedDate = new Date(2025, 5, 15, 14, 30); // June 15, 2025, 14:30
    const wrapper = shallow(<DateTimePicker selected={selectedDate} onChange={jest.fn()} />);
    const html = wrapper.html();
    expect(html).toContain('2025-06-15');
    expect(html).toContain('14:30');
  });

  it('accepts date as timestamp number', () => {
    const timestamp = new Date(2025, 5, 15, 14, 30).getTime();
    const wrapper = shallow(<DateTimePicker selected={timestamp} onChange={jest.fn()} />);
    const html = wrapper.html();
    expect(html).toContain('2025-06-15');
    expect(html).toContain('14:30');
  });

  it('renders with min and max date constraints', () => {
    const minDate = new Date(2025, 5, 1);
    const maxDate = new Date(2025, 5, 30);
    const selectedDate = new Date(2025, 5, 15, 14, 30);
    const wrapper = shallow(
      <DateTimePicker selected={selectedDate} minDate={minDate} maxDate={maxDate} onChange={jest.fn()} />
    );
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });

  it('renders with data-test attribute for testing', () => {
    const wrapper = shallow(<DateTimePicker onChange={jest.fn()} />);
    const html = wrapper.html();
    expect(html).toContain('data-test="date-time-picker"');
  });

  it('displays time in 24-hour format', () => {
    // Test morning time
    const morningDate = new Date(2025, 5, 15, 9, 5);
    let wrapper = shallow(<DateTimePicker selected={morningDate} onChange={jest.fn()} />);
    let html = wrapper.html();
    expect(html).toContain('09:05');

    // Test afternoon time
    const afternoonDate = new Date(2025, 5, 15, 15, 45);
    wrapper = shallow(<DateTimePicker selected={afternoonDate} onChange={jest.fn()} />);
    html = wrapper.html();
    expect(html).toContain('15:45');

    // Test midnight
    const midnightDate = new Date(2025, 5, 15, 0, 0);
    wrapper = shallow(<DateTimePicker selected={midnightDate} onChange={jest.fn()} />);
    html = wrapper.html();
    expect(html).toContain('00:00');
  });

  it('pads single digit months and days with zeros', () => {
    const date = new Date(2025, 0, 5, 14, 30); // January 5, 2025
    const wrapper = shallow(<DateTimePicker selected={date} onChange={jest.fn()} />);
    const html = wrapper.html();
    expect(html).toContain('2025-01-05');
  });
});
