import * as React from 'react';
import { toString } from './Utils';

interface TimeProps {
  time: string;
}

export class LocalTime extends React.Component<TimeProps> {
  render() {
    let renderedTime: string;

    if (this.props.time) {
      renderedTime = toString(new Date(this.props.time).valueOf());
    } else {
      renderedTime = '-';
    }

    return <>{renderedTime}</>;
  }
}
