import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import DatePicker from 'react-datepicker';
import style from './DateTimePicker.module.scss';

const pickerStyle = kialiStyle({
  height: '36px',
  paddingLeft: '.75em',
  width: '10em'
});

const calendarStyle = kialiStyle({
  $nest: {
    '&.react-datepicker': {
      fontFamily: 'var(--pf-v5-global--FontFamily--text)',
      fontSize: 'var(--pf-v5-global--FontSize--md)'
    },

    // provide more space for time container given bigger font
    '& .react-datepicker__time-container': {
      width: '110px',
      $nest: {
        '& .react-datepicker__time .react-datepicker__time-box': {
          width: '100%'
        }
      }
    },

    '& .react-datepicker__navigation--next--with-time:not(.react-datepicker__navigation--next--with-today-button)': {
      right: '118px'
    }
  }
});

const popperStyle = kialiStyle({
  $nest: {
    '&.react-datepicker-popper': {
      zIndex: 100
    }
  }
});

export const DateTimePicker = (props: any) => {
  return (
    <div className={style.dateTimePicker}>
      <DatePicker
        className={pickerStyle}
        calendarClassName={calendarStyle}
        popperClassName={popperStyle}
        dateFormat="MMM dd, hh:mm aa"
        popperPlacement="bottom-start"
        popperModifiers={{
          offset: {
            enabled: true,
            offset: '5px, 10px'
          },
          preventOverflow: {
            enabled: true,
            escapeWithReference: false,
            boundariesElement: 'viewport'
          }
        }}
        showTimeSelect={true}
        timeCaption="Time"
        timeFormat="hh:mm aa"
        timeIntervals={5}
        {...props}
      />
    </div>
  );
};
