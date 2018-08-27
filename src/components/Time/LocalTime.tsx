import * as React from 'react';

interface TimeProps {
  time: string;
}

export default class LocalTime extends React.Component<TimeProps> {
  render() {
    let renderedTime: string;

    if (this.props.time) {
      renderedTime = new Date(this.props.time).toLocaleString();
    } else {
      renderedTime = '-';
    }

    return renderedTime;
  }
}
