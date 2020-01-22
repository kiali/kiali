import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';
import { toString } from './Utils';

interface TimeProps {
  time: string;
}

export default class LocalTime extends React.Component<TimeProps> {
  render() {
    let renderedTime: string;

    if (this.props.time) {
      renderedTime = toString(new Date(this.props.time).valueOf());
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
