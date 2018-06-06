import * as React from 'react';
import { PollIntervalInMs } from '../../types/GraphFilter';
import { SplitButton, MenuItem, Icon, OverlayTrigger, Tooltip } from 'patternfly-react';

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
      <OverlayTrigger
        overlay={<Tooltip id={`${props.id}_tooltip`}>{props.options[props.selected]}</Tooltip>}
        placement="top"
        trigger={['hover', 'focus']}
        rootClose={false}
      >
        <SplitButton id={`${props.id}`} title={<Icon name="refresh" />} onClick={props.handleRefresh} pullRight={true}>
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
        </SplitButton>
      </OverlayTrigger>
    </>
  );
};

export default GraphRefresh;
