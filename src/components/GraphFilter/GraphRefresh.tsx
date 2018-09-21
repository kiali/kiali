import * as React from 'react';
import { PollIntervalInMs } from '../../types/Common';
import { Duration } from '../../types/GraphFilter';
import { Button, MenuItem, Icon, DropdownButton } from 'patternfly-react';
import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';
import { config } from '../../config';

type GraphRefreshProps = {
  id: string;
  handleRefresh: () => void;
  onUpdatePollInterval: (selected: PollIntervalInMs) => void;
  pollInterval: PollIntervalInMs;
  options: {
    [interval: number]: string;
  };
  graphDuration: Duration;
  onUpdateGraphDuration: (duration: number) => void;
  disabled: boolean;
};

const GraphRefresh: React.SFC<GraphRefreshProps> = props => {
  const INTERVAL_DURATION = config().toolbar.intervalDuration;

  const formatRefreshText = (key, isTitle: boolean = false): string => {
    // Ensure that we have an integer (for comparisons).
    key = parseInt(key, 10);

    if (isTitle) {
      return key !== 0 ? `Every ${props.options[key]}` : 'Paused';
    } else {
      return key !== 0 ? `Every ${props.options[key]}` : props.options[key];
    }
  };

  return (
    <>
      <label style={{ paddingRight: '0.5em', marginLeft: '1.5em' }}>Fetching</label>
      <ToolbarDropdown
        id={'graph_filter_interval_duration'}
        disabled={props.disabled}
        handleSelect={props.onUpdateGraphDuration}
        value={props.graphDuration.value}
        label={String(INTERVAL_DURATION[props.graphDuration.value])}
        options={INTERVAL_DURATION}
      />
      <DropdownButton
        id="graph_refresh_dropdown"
        title={formatRefreshText(props.pollInterval, true)}
        disabled={props.disabled}
      >
        {Object.keys(props.options).map((key: any) => {
          return (
            <MenuItem
              key={key}
              eventKey={key}
              active={Number(key) === props.pollInterval}
              onSelect={value => props.onUpdatePollInterval(Number(value))}
            >
              {formatRefreshText(key)}
            </MenuItem>
          );
        })}
      </DropdownButton>
      <span style={{ paddingLeft: '0.5em' }}>
        <Button id="refresh_button" onClick={props.handleRefresh} disabled={props.disabled}>
          <Icon name="refresh" />
        </Button>
      </span>
    </>
  );
};

export default GraphRefresh;
