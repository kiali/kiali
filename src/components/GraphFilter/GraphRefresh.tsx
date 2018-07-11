import * as React from 'react';
import { PollIntervalInMs } from '../../types/GraphFilter';
import { Button, MenuItem, Icon, DropdownButton } from 'patternfly-react';

type GraphRefreshProps = {
  id: string;
  handleRefresh: () => void;
  onSelect: (selected: PollIntervalInMs) => void;
  selected: PollIntervalInMs;
  options: {
    [interval: number]: string;
  };
};

const GraphRefresh: React.SFC<GraphRefreshProps> = props => {
  return (
    <>
      <label style={{ paddingRight: '0.5em' }}>Refreshing</label>
      <DropdownButton id="graph_refresh_dropdown" title={props.options[props.selected]} onSelect={props.handleRefresh}>
        {Object.keys(props.options).map((key: any) => {
          return (
            <MenuItem
              key={key}
              eventKey={key}
              active={Number(key) === props.selected}
              onSelect={value => props.onSelect(Number(value))}
            >
              {props.options[key]}
            </MenuItem>
          );
        })}
      </DropdownButton>
      <span style={{ paddingLeft: '0.5em' }}>
        <Button id="refresh_button" onClick={props.handleRefresh}>
          <Icon name="refresh" />
        </Button>
      </span>
    </>
  );
};

export default GraphRefresh;
