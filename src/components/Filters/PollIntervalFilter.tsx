import * as React from 'react';

import { config } from '../../config';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { PollInterval } from '../../types/GraphFilter';

type PollIntervalFilterProps = {
  id: string;
  disabled: boolean;
  onPollIntervalChanged: (interval: number) => void;
  selected?: PollInterval;
};

const PollIntervals = config().toolbar.pollInterval;
const DefaultPollInterval = config().toolbar.defaultPollInterval;

const PollIntervalFilter: React.SFC<PollIntervalFilterProps> = props => {
  const selectedLabel = PollIntervals[props.selected!.value]
    ? PollIntervals[props.selected!.value]
    : `${props.selected!.value} ms`;
  return (
    <ToolbarDropdown
      id={props.id}
      disabled={props.disabled}
      handleSelect={props.onPollIntervalChanged}
      nameDropdown="Poll Interval"
      initialValue={props.selected!.value}
      initialLabel={selectedLabel}
      options={PollIntervals}
    />
  );
};

PollIntervalFilter.defaultProps = {
  selected: { value: DefaultPollInterval }
};

export default PollIntervalFilter;
