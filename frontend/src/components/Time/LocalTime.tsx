import * as React from 'react';
import { toString } from './Utils';

interface TimeProps {
  time: string;
}

export class LocalTime extends React.Component<TimeProps> {
  render(): React.ReactNode {
    let renderedTime: string;

    if (this.props.time) {
      const date = new Date(this.props.time);
      renderedTime = date.getFullYear() <= 1 ? 'Unknown' : toString(date.valueOf());
    } else {
      renderedTime = '-';
    }

    return <>{renderedTime}</>;
  }
}
