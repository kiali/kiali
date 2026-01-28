import * as React from 'react';
import {
  Button,
  CalendarMonth,
  Dropdown,
  DropdownItem,
  DropdownList,
  InputGroup,
  InputGroupItem,
  MenuToggle,
  MenuToggleElement,
  Popover,
  TextInput
} from '@patternfly/react-core';
import { OutlinedCalendarAltIcon, OutlinedClockIcon } from '@patternfly/react-icons';

interface DateTimePickerProps {
  injectTimes?: Date[];
  maxDate?: Date | number;
  minDate?: Date | number;
  onChange: (date: Date) => void;
  selected?: Date | number;
}

// Generate time options for the dropdown (every 5 minutes, 24-hour format)
const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      options.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return options;
};

const timeOptions = generateTimeOptions();

const dateFormat = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const timeFormat = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const toDate = (value?: Date | number): Date | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === 'number' ? new Date(value) : value;
};

export const DateTimePicker: React.FC<DateTimePickerProps> = (props: DateTimePickerProps) => {
  const { maxDate, minDate, onChange, selected } = props;

  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isTimeOpen, setIsTimeOpen] = React.useState(false);

  const selectedDate = toDate(selected);
  const minDateValue = toDate(minDate);
  const maxDateValue = toDate(maxDate);

  const displayDate = selectedDate ? dateFormat(selectedDate) : 'YYYY-MM-DD';
  const displayTime = selectedDate ? timeFormat(selectedDate) : 'HH:MM';

  const onToggleCalendar = (): void => {
    setIsCalendarOpen(!isCalendarOpen);
    setIsTimeOpen(false);
  };

  const onToggleTime = (): void => {
    setIsTimeOpen(!isTimeOpen);
    setIsCalendarOpen(false);
  };

  const onSelectCalendar = (_event: React.MouseEvent<HTMLButtonElement, MouseEvent>, newDate: Date): void => {
    // Preserve time when date changes
    const currentDate = selectedDate ?? new Date();
    newDate.setHours(currentDate.getHours());
    newDate.setMinutes(currentDate.getMinutes());
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    // Apply min/max constraints
    if (minDateValue && newDate < minDateValue) {
      newDate = new Date(minDateValue);
    }
    if (maxDateValue && newDate > maxDateValue) {
      newDate = new Date(maxDateValue);
    }

    setIsCalendarOpen(false);
    onChange(newDate);
  };

  const onSelectTime = (ev: React.MouseEvent<Element, MouseEvent> | undefined): void => {
    const timeString = ev?.currentTarget?.textContent;
    if (timeString) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const currentDate = selectedDate ? new Date(selectedDate) : new Date();
      currentDate.setHours(hours);
      currentDate.setMinutes(minutes);
      currentDate.setSeconds(0);
      currentDate.setMilliseconds(0);

      // Apply min/max constraints
      let resultDate = currentDate;
      if (minDateValue && resultDate < minDateValue) {
        resultDate = new Date(minDateValue);
      }
      if (maxDateValue && resultDate > maxDateValue) {
        resultDate = new Date(maxDateValue);
      }

      setIsTimeOpen(false);
      onChange(resultDate);
    }
  };

  // Validator for CalendarMonth to disable dates outside min/max range
  const dateValidator = (date: Date): boolean => {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (minDateValue) {
      const minDateOnly = new Date(minDateValue.getFullYear(), minDateValue.getMonth(), minDateValue.getDate());
      if (dateOnly < minDateOnly) {
        return false;
      }
    }
    if (maxDateValue) {
      const maxDateOnly = new Date(maxDateValue.getFullYear(), maxDateValue.getMonth(), maxDateValue.getDate());
      if (dateOnly > maxDateOnly) {
        return false;
      }
    }
    return true;
  };

  const calendar = (
    <CalendarMonth
      date={selectedDate}
      onChange={onSelectCalendar}
      validators={[dateValidator]}
      aria-label="Date picker calendar"
    />
  );

  const timeDropdownItems = timeOptions.map(time => (
    <DropdownItem key={time} onClick={onSelectTime}>
      {time}
    </DropdownItem>
  ));

  const timeDropdown = (
    <Dropdown
      isOpen={isTimeOpen}
      onOpenChange={(isOpen: boolean) => setIsTimeOpen(isOpen)}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={onToggleTime}
          isExpanded={isTimeOpen}
          aria-label="Time picker"
          icon={<OutlinedClockIcon />}
        />
      )}
      isScrollable
    >
      <DropdownList>{timeDropdownItems}</DropdownList>
    </Dropdown>
  );

  const calendarButton = (
    <Popover
      position="bottom"
      bodyContent={calendar}
      showClose={false}
      isVisible={isCalendarOpen}
      hasNoPadding
      hasAutoWidth
      onHide={() => setIsCalendarOpen(false)}
    >
      <Button
        variant="control"
        aria-label="Toggle the calendar"
        onClick={onToggleCalendar}
        icon={<OutlinedCalendarAltIcon />}
      />
    </Popover>
  );

  return (
    <div style={{ display: 'inline-flex', marginRight: '0.5rem' }}>
      <InputGroup>
        <InputGroupItem>
          <TextInput
            type="text"
            id="date-time-picker"
            aria-label="Date and time picker"
            value={`${displayDate} ${displayTime}`}
            readOnlyVariant="default"
            style={{ width: '11em' }}
          />
        </InputGroupItem>
        <InputGroupItem>{calendarButton}</InputGroupItem>
        <InputGroupItem>{timeDropdown}</InputGroupItem>
      </InputGroup>
    </div>
  );
};
