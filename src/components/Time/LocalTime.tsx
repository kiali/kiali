import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';

interface TimeProps {
  time: string;
}

export default class LocalTime extends React.Component<TimeProps> {
  render() {
    let renderedTime: string;

    if (this.props.time) {
      const date = new Date(this.props.time);
      const options = {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      } as any;
      if (date.getFullYear() !== new Date().getFullYear()) {
        options.year = 'numeric';
      }
      renderedTime = date.toLocaleString('en-US', options);
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
