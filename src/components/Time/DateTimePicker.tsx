import * as React from 'react';
import { style } from 'typestyle';
import DatePicker from 'react-datepicker';

const pickerStyle = style({
  height: '36px',
  paddingLeft: '.75em',
  width: '10em'
});

export const DateTimePicker = (props: any) => {
  return (
    <DatePicker
      className={pickerStyle}
      dateFormat="MMM dd, hh:mm aa"
      popperPlacement="auto-end"
      showTimeSelect={true}
      timeCaption="Time"
      timeFormat="hh:mm aa"
      timeIntervals={5}
      {...props}
    />
  );
};
