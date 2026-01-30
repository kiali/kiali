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
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';

const containerStyle = kialiStyle({
  display: 'inline-flex'
});

const inputStyle = kialiStyle({
  width: '11em'
});

interface DateTimePickerProps {
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

// Check if two dates are on the same day
const isSameDay = (date1: Date, date2: Date): boolean => {
  return compareDate(date1, date2) === 0;
};

// Compare dates (year, month, day only, ignoring time)
// Returns: -1 if date is before refDate, 0 if same day, 1 if after
const compareDate = (date: Date, refDate: Date): number => {
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const d2 = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());

  if (d1 < d2) {
    return -1;
  }
  if (d1 > d2) {
    return 1;
  }
  return 0;
};

// Compare time (hours and minutes only, ignoring seconds)
// Returns: -1 if time is before refDate, 0 if equal, 1 if after
const compareTime = (hours: number, minutes: number, refDate: Date): number => {
  const refHours = refDate.getHours();
  const refMinutes = refDate.getMinutes();

  if (hours < refHours || (hours === refHours && minutes < refMinutes)) {
    return -1;
  }
  if (hours > refHours || (hours === refHours && minutes > refMinutes)) {
    return 1;
  }
  return 0;
};

// Counter for generating unique IDs per DateTimePicker instance
// TODO: Replace with React.useId() when upgrading to React 18+
let dateTimePickerIdCounter = 0;

export const DateTimePicker: React.FC<DateTimePickerProps> = (props: DateTimePickerProps) => {
  const { maxDate, minDate, onChange, selected } = props;

  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  const [isTimeOpen, setIsTimeOpen] = React.useState(false);

  // Generate a unique ID for this instance to scope DOM queries
  const [instanceId] = React.useState(() => `dtp-${++dateTimePickerIdCounter}`);

  const selectedDate = toDate(selected);
  const minDateValue = toDate(minDate);
  const maxDateValue = toDate(maxDate);

  const displayDate = selectedDate ? dateFormat(selectedDate) : 'YYYY-MM-DD';
  const displayTime = selectedDate ? timeFormat(selectedDate) : 'HH:MM';

  // Scroll to current time when dropdown opens
  React.useEffect(() => {
    if (isTimeOpen && selectedDate) {
      // Find the closest 5-minute interval for the current time
      const hours = selectedDate.getHours();
      const minutes = Math.floor(selectedDate.getMinutes() / 5) * 5;
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      // Small delay to ensure dropdown is rendered (portal renders async)
      setTimeout(() => {
        // Find the dropdown item scoped to this instance
        const timeItem = document.querySelector(`[data-instance="${instanceId}"][data-time="${timeString}"]`);
        if (timeItem) {
          timeItem.scrollIntoView({ block: 'center' });
        }
      }, 50);
    }
  }, [isTimeOpen, selectedDate, instanceId]);

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
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);

    // Apply min/max constraints (compare hours and minutes only when on same day)
    if (minDateValue && isSameDay(newDate, minDateValue) && compareTime(hours, minutes, minDateValue) < 0) {
      newDate.setHours(minDateValue.getHours());
      newDate.setMinutes(minDateValue.getMinutes());
    }

    if (maxDateValue && isSameDay(newDate, maxDateValue) && compareTime(hours, minutes, maxDateValue) > 0) {
      newDate.setHours(maxDateValue.getHours());
      newDate.setMinutes(maxDateValue.getMinutes());
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

      // Apply min/max constraints only when on the same day
      if (minDateValue && isSameDay(currentDate, minDateValue) && compareTime(hours, minutes, minDateValue) < 0) {
        currentDate.setHours(minDateValue.getHours());
        currentDate.setMinutes(minDateValue.getMinutes());
      }

      if (maxDateValue && isSameDay(currentDate, maxDateValue) && compareTime(hours, minutes, maxDateValue) > 0) {
        currentDate.setHours(maxDateValue.getHours());
        currentDate.setMinutes(maxDateValue.getMinutes());
      }

      setIsTimeOpen(false);
      onChange(currentDate);
    }
  };

  // Validator for CalendarMonth to disable dates outside min/max range
  const dateValidator = (date: Date): boolean => {
    if (minDateValue && compareDate(date, minDateValue) < 0) {
      return false;
    }
    if (maxDateValue && compareDate(date, maxDateValue) > 0) {
      return false;
    }
    return true;
  };

  // Check if a time option is valid for the currently selected date
  const isTimeDisabled = (timeString: string): boolean => {
    if (!selectedDate) {
      return false;
    }

    const [hours, minutes] = timeString.split(':').map(Number);

    // Disable if on same day as minDate and time is before minDate's time
    if (minDateValue && isSameDay(selectedDate, minDateValue) && compareTime(hours, minutes, minDateValue) < 0) {
      return true;
    }
    // Disable if on same day as maxDate and time is after maxDate's time
    if (maxDateValue && isSameDay(selectedDate, maxDateValue) && compareTime(hours, minutes, maxDateValue) > 0) {
      return true;
    }
    return false;
  };

  const calendar = (
    <CalendarMonth
      date={selectedDate}
      onChange={onSelectCalendar}
      validators={[dateValidator]}
      aria-label={t('Date picker calendar')}
    />
  );

  const timeDropdownItems = timeOptions.map(time => {
    const disabled = isTimeDisabled(time);

    return (
      <DropdownItem key={time} onClick={onSelectTime} isDisabled={disabled} data-instance={instanceId} data-time={time}>
        {time}
      </DropdownItem>
    );
  });

  const timeDropdown = (
    <Dropdown
      isOpen={isTimeOpen}
      onOpenChange={(isOpen: boolean) => setIsTimeOpen(isOpen)}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={onToggleTime}
          isExpanded={isTimeOpen}
          aria-label={t('Time picker')}
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
        aria-label={t('Toggle the calendar')}
        onClick={onToggleCalendar}
        icon={<OutlinedCalendarAltIcon />}
      />
    </Popover>
  );

  return (
    <div className={containerStyle}>
      <InputGroup>
        <InputGroupItem>
          <TextInput
            type="text"
            aria-label={t('Date and time picker')}
            value={`${displayDate} ${displayTime}`}
            readOnlyVariant="default"
            className={inputStyle}
            data-test="date-time-picker"
          />
        </InputGroupItem>
        <InputGroupItem>{calendarButton}</InputGroupItem>
        <InputGroupItem>{timeDropdown}</InputGroupItem>
      </InputGroup>
    </div>
  );
};
