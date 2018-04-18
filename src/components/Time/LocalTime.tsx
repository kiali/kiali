import * as React from 'react';

interface TimeProps {
  time: string;
}

export default class LocalTime extends React.Component<TimeProps> {
  render() {
    return new Date(this.props.time).toLocaleString();
  }
}
