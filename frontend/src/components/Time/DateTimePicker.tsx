import * as React from 'react';
import { DatePicker, TimePicker, Flex, FlexItem } from '@patternfly/react-core';

// PF6 components handle styling internally, so we can remove the legacy kialiStyle blocks.

export const DateTimePicker = (props: any) => {
  const { selected, onChange, minDate, maxDate } = props;

  const handleDateChange = (_event: React.FormEvent<HTMLInputElement>, _value: string, date?: Date) => {
    if (date && onChange) {
      // Preserve time when date changes
      const current = selected ? new Date(selected) : new Date();
      date.setHours(current.getHours());
      date.setMinutes(current.getMinutes());
      date.setSeconds(0);
      onChange(date);
    }
  };

  const handleTimeChange = (_event: React.FormEvent<HTMLInputElement>, _time: string, hour?: number, minute?: number) => {
    if (onChange && hour !== undefined && minute !== undefined) {
      // Preserve date when time changes
      const current = selected ? new Date(selected) : new Date();
      current.setHours(hour);
      current.setMinutes(minute);
      current.setSeconds(0);
      onChange(current);
    }
  };

  return (
    <Flex direction={{ default: 'row' }} spacer={{ default: 'spacerSm' }}>
      <FlexItem>
        <DatePicker
          value={selected ? new Date(selected).toISOString().split('T')[0] : ''}
          onChange={handleDateChange}
          validators={[
            (date: Date) => {
              if (minDate && date < minDate) return 'Date is before minimum allowed date';
              if (maxDate && date > maxDate) return 'Date is after maximum allowed date';
              return '';
            }
          ]}
          aria-label="Date picker"
        />
      </FlexItem>
      <FlexItem>
        <TimePicker
          time={selected ? new Date(selected).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
          onChange={handleTimeChange}
          aria-label="Time picker"
          is24Hour
        />
      </FlexItem>
    </Flex>
  );
};
