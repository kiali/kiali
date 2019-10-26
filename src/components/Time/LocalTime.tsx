import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';

interface TimeProps {
  time: string;
}

const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDate = (date: string) => {
  const mdate = new Date(date);
  const monthStr = monthAbbrs[mdate.getMonth()];

  let a = 'am';
  let hours = mdate.getHours();
  if (hours > 12) {
    hours -= 12;
    a = 'pm';
  }

  const minuteStr = mdate
    .getMinutes()
    .toString()
    .padStart(2, '00');
  let timeStr = `${hours}:${minuteStr} ${a}`;
  if (mdate.getFullYear() !== new Date().getFullYear()) {
    timeStr = `${mdate.getFullYear()} ${timeStr}`;
  }

  return `${monthStr} ${mdate.getDate()}, ${timeStr}`;
};

export default class LocalTime extends React.Component<TimeProps> {
  render() {
    let renderedTime: string;

    if (this.props.time) {
      renderedTime = formatDate(this.props.time);
    } else {
      renderedTime = '-';
    }

    return (
      <Tooltip content={<>{this.props.time}</>}>
        <span>
          {KialiIcon.LocalTime({})} {renderedTime}
        </span>
      </Tooltip>
    );
  }
}
